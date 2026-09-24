import { NextRequest, NextResponse } from "next/server";
import { requireTutor, resolveActingTutorSub, listTutors } from "@/lib/auth-helpers";
import {
  createSession,
  completeSessionWithNotes,
  getSession,
  getSessionsByStudent,
  getUserProfile,
  getReferralByInvitedEmail,
  updateReferralCreditAwarded,
  incrementFreeSessionCredits,
  TutoringSession,
} from "@/lib/dynamodb";
import { sendSessionNoteEmail, sendReferralCreditEmail } from "@/lib/ses";
import { getDownloadUrl } from "@/lib/s3";
import { randomUUID } from "crypto";

// POST - Adds notes to a student's session. If `sessionId` names an existing
// scheduled booking, notes attach to it and tutor-history attribution comes
// from that booking's own assignment (chooseTutor already decided it, per
// ADR-0009) — the caller's identity is irrelevant here. Only a note with no
// underlying booking (a walk-in/make-up lesson) creates a new session, and
// only then does it matter who's acting via ?tutorSub=.
export async function POST(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  try {
    const body = await request.json();
    const { studentSub, studentEmail, subject, notes, topics, sessionId } = body;

    if (!studentSub || !notes) {
      return NextResponse.json(
        { error: "studentSub and notes are required" },
        { status: 400 }
      );
    }

    let session: TutoringSession;

    if (sessionId) {
      const existing = await getSession(sessionId);
      if (!existing || existing.studentSub !== studentSub) {
        return NextResponse.json(
          { error: "Session not found for this student" },
          { status: 404 }
        );
      }
      if (existing.status !== "scheduled") {
        return NextResponse.json(
          { error: "This session has already been logged" },
          { status: 409 }
        );
      }

      const resolvedSubject = subject || existing.subject;
      const resolvedTopics = topics || [];
      try {
        await completeSessionWithNotes(sessionId, {
          subject: resolvedSubject,
          notes,
          topics: resolvedTopics,
        });
      } catch (err: any) {
        const alreadyLogged =
          err.name === "ConditionalCheckFailedException" ||
          err.__type?.includes("ConditionalCheckFailedException");
        if (alreadyLogged) {
          return NextResponse.json(
            { error: "This session has already been logged" },
            { status: 409 }
          );
        }
        throw err;
      }
      session = {
        ...existing,
        subject: resolvedSubject,
        notes,
        topics: resolvedTopics,
        status: "completed",
      };
    } else {
      const acting = resolveActingTutorSub(
        user.sub,
        request.nextUrl.searchParams.get("tutorSub")
      );
      if (!acting.ok) {
        return NextResponse.json({ error: acting.error }, { status: acting.status });
      }

      session = {
        id: randomUUID(),
        studentSub,
        studentEmail: studentEmail || "",
        tutorSub: acting.tutorSub,
        scheduledAt: new Date().toISOString(),
        duration: 60,
        subject: subject || "General Math",
        notes,
        topics: topics || [],
        status: "completed",
        reminderSent: false,
        createdAt: new Date().toISOString(),
      };
      await createSession(session);
    }

    // Send email notification to student (and parent if set)
    try {
      const recipients: string[] = [studentEmail || ""].filter(Boolean);

      const profile = await getUserProfile(studentSub);
      if (profile?.parentEmail) {
        recipients.push(profile.parentEmail);
      }

      if (recipients.length > 0) {
        await sendSessionNoteEmail({
          to: recipients,
          subject: session.subject,
          notes: session.notes,
          studentName: studentEmail?.split("@")[0] || "Student",
        });
      }
    } catch (emailError: any) {
      // Don't fail the request if email fails
      console.error("Failed to send session note email:", emailError);
    }

    // Check if this student was referred and this is their first completed session
    try {
      const referral = await getReferralByInvitedEmail(
        (studentEmail || "").toLowerCase()
      );
      if (referral && referral.status === "signed_up") {
        // Count completed sessions for this student
        const allSessions = await getSessionsByStudent(studentSub);
        const completedCount = allSessions.filter(
          (s) => s.status === "completed"
        ).length;

        // If this is the first completed session (the one we just created)
        if (completedCount === 1) {
          // Award referrer a free credit
          await updateReferralCreditAwarded(referral.token);
          await incrementFreeSessionCredits(referral.referrerSub, 1);

          // Notify the referrer
          const referrerProfile = await getUserProfile(referral.referrerSub);
          if (referrerProfile) {
            try {
              await sendReferralCreditEmail({
                to: referrerProfile.email,
                referrerName:
                  referrerProfile.displayName ||
                  referrerProfile.email.split("@")[0],
                referredStudentName:
                  studentEmail?.split("@")[0] || "A friend",
              });
            } catch {
              // Don't fail if email fails
            }
          }
        }
      }
    } catch (referralError) {
      // Don't fail the request if referral logic fails
      console.error("Referral credit check error:", referralError);
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    console.error("Create session note error:", error);
    return NextResponse.json(
      { error: "Failed to create session note" },
      { status: 500 }
    );
  }
}

// GET - Tutor views session notes and scheduled bookings for a specific
// student, the latter enriched with tutorName so the "which session is this
// for?" picker can show who a booking was already assigned to.
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const studentSub = request.nextUrl.searchParams.get("studentSub");
  if (!studentSub) {
    return NextResponse.json(
      { error: "studentSub query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const [sessions, tutors] = await Promise.all([
      getSessionsByStudent(studentSub),
      listTutors(),
    ]);
    const tutorNameMap = new Map(tutors.map((t) => [t.sub, t.name || t.email]));
    const enriched = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        tutorName: tutorNameMap.get(s.tutorSub) || "",
        attachments: s.attachments
          ? await Promise.all(
              s.attachments.map(async (a) => ({
                ...a,
                url: await getDownloadUrl(a.key),
              }))
            )
          : undefined,
      }))
    );
    return NextResponse.json({ sessions: enriched });
  } catch (error: any) {
    console.error("Get session notes error:", error);
    return NextResponse.json(
      { error: "Failed to get session notes" },
      { status: 500 }
    );
  }
}
