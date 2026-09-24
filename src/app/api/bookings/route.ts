import { NextRequest, NextResponse } from "next/server";
import {
  extractToken,
  verifyToken,
  getHouseholdSub,
  listTutors,
  TutorIdentity,
} from "@/lib/auth-helpers";
import {
  bookSession,
  cancelBooking,
  getSession,
  getSessionsByStudent,
  getUserProfile,
  getMostRecentTutorForStudent,
  getWeeklyAvailability,
  getDateOverrides,
  getScheduledSessionsByDateRange,
  decrementFreeSessionCredit,
  updateSessionGoogleEvent,
  TutoringSession,
} from "@/lib/dynamodb";
import { getAvailabilityForDate, generateTimeSlots, filterBookedSlots } from "@/lib/slots";
import { chooseTutor } from "@/lib/booking-assignment";
import {
  getFounderBusyIntervals,
  insertTutoringEvent,
  deleteTutoringEvent,
} from "@/lib/google-calendar";
import { awsConfig } from "@/lib/aws-config";
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
} from "@/lib/ses";
import { randomUUID } from "crypto";
import { formatInTimeZone } from "date-fns-tz";

const TUTOR_TIMEZONE = process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

/**
 * Which of the given tutors are actually free at this exact start time —
 * i.e. the time falls within their generated availability for that date and
 * they don't already have a session booked then. Re-derived at booking time
 * (rather than trusted from the earlier /api/slots union) so a race between
 * two students booking the same union slot resolves correctly.
 */
async function getFreeTutorSubs(
  scheduledAt: string,
  tutors: TutorIdentity[]
): Promise<Set<string>> {
  const dateStr = formatInTimeZone(new Date(scheduledAt), TUTOR_TIMEZONE, "yyyy-MM-dd");
  // `tutors` is oldest-account-first (listTutors()); index 0 is the founder,
  // same convention chooseTutor() below uses.
  const founderSub = tutors[0]?.sub;
  const free = new Set<string>();

  await Promise.all(
    tutors.map(async (tutor) => {
      const [weekly, overrides, bookedForTutor] = await Promise.all([
        getWeeklyAvailability(tutor.sub),
        getDateOverrides(tutor.sub, dateStr, dateStr),
        getScheduledSessionsByDateRange(
          dateStr + "T00:00:00.000Z",
          dateStr + "T23:59:59.999Z"
        ),
      ]);
      const windows = getAvailabilityForDate(dateStr, weekly, overrides, TUTOR_TIMEZONE);
      const daySlots = generateTimeSlots(dateStr, windows, 60, TUTOR_TIMEZONE);
      const bookedTimes = bookedForTutor
        .filter((s) => s.tutorSub === tutor.sub)
        .map((s) => s.scheduledAt);
      const availableSlots = filterBookedSlots(daySlots, bookedTimes);
      if (!availableSlots.includes(scheduledAt)) return;

      // Founder's real-world calendars (school, RA duty, etc.) get the
      // final say at booking time too — see docs/adr/0008. A narrow window
      // around just this slot, not the whole day. Fail closed: if the
      // check can't be made, don't add him as a candidate.
      if (tutor.sub === founderSub) {
        const bufferMs = awsConfig.google.bufferMinutes * 60_000;
        const slotStart = new Date(scheduledAt);
        const windowStart = new Date(slotStart.getTime() - bufferMs).toISOString();
        const windowEnd = new Date(slotStart.getTime() + 60 * 60_000 + bufferMs).toISOString();
        const busy = await getFounderBusyIntervals(windowStart, windowEnd);
        if (busy === null || busy.length > 0) return;
      }

      free.add(tutor.sub);
    })
  );

  return free;
}

// POST - Student books a session; the system assigns the tutor (pooled booking)
export async function POST(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { scheduledAt, subject, useFreeCredit } = body;

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "scheduledAt is required" },
        { status: 400 }
      );
    }

    // Ensure the slot is in the future
    if (new Date(scheduledAt) <= new Date()) {
      return NextResponse.json(
        { error: "Cannot book a slot in the past" },
        { status: 400 }
      );
    }

    // Students may only book up to 14 days in advance
    const fourteenDaysOut = new Date();
    fourteenDaysOut.setDate(fourteenDaysOut.getDate() + 14);
    if (new Date(scheduledAt) > fourteenDaysOut) {
      return NextResponse.json(
        { error: "You can only book sessions up to 2 weeks in advance" },
        { status: 400 }
      );
    }

    const householdSub = await getHouseholdSub(user.sub);

    const tutors = await listTutors();
    if (tutors.length === 0) {
      return NextResponse.json(
        { error: "No tutors are currently available" },
        { status: 409 }
      );
    }

    const preferredTutorSub = await getMostRecentTutorForStudent(householdSub);

    // Try candidates in preference order; a race against another student's
    // booking on the same tutor shows up as a TransactionCanceledException,
    // in which case fall through to the next eligible tutor.
    let candidates = await getFreeTutorSubs(scheduledAt, tutors);
    let session: TutoringSession | null = null;
    let lastError: any = null;

    while (candidates.size > 0) {
      const chosenTutorSub = chooseTutor(candidates, tutors, preferredTutorSub);
      if (!chosenTutorSub) break;

      const candidateSession: TutoringSession = {
        id: randomUUID(),
        studentSub: householdSub,
        studentEmail: user.email,
        tutorSub: chosenTutorSub,
        scheduledAt,
        duration: 60,
        subject: subject || "KL Math Prep",
        notes: "",
        paidWithCredit: !!useFreeCredit,
        status: "scheduled",
        reminderSent: false,
        createdAt: new Date().toISOString(),
      };

      try {
        await bookSession(candidateSession);
        session = candidateSession;
        break;
      } catch (error: any) {
        lastError = error;
        const isConflict =
          error.name === "TransactionCanceledException" ||
          error.__type?.includes("TransactionCanceledException");
        if (!isConflict) throw error;
        candidates.delete(chosenTutorSub);
      }
    }

    if (!session) {
      if (lastError) throw lastError;
      return NextResponse.json(
        { error: "This time slot is no longer available" },
        { status: 409 }
      );
    }

    // Decrement free session credit if used (shared household pool)
    if (useFreeCredit) {
      try {
        await decrementFreeSessionCredit(householdSub);
      } catch (creditError) {
        console.error("Failed to decrement credit:", creditError);
        // Don't fail the booking if credit decrement fails
      }
    }

    // Send confirmation email (non-blocking)
    try {
      const recipients = [user.email];
      const profile = await getUserProfile(householdSub);
      if (profile?.parentEmail) {
        recipients.push(profile.parentEmail);
      }
      if (profile?.email && profile.email !== user.email) {
        recipients.push(profile.email);
      }

      const assignedTutor = tutors.find((t) => t.sub === session!.tutorSub);
      if (assignedTutor?.email) {
        recipients.push(assignedTutor.email);
      }
      const tutorProfile = assignedTutor
        ? await getUserProfile(assignedTutor.sub)
        : null;

      await sendBookingConfirmationEmail({
        to: recipients,
        studentName: user.email.split("@")[0],
        scheduledAt,
        subject: session.subject,
        meetingRoomUrl: tutorProfile?.meetingRoomUrl,
      });
    } catch (emailError) {
      console.error("Failed to send booking confirmation email:", emailError);
    }

    // Push the session onto the founder's Tutoring calendar — every
    // booking regardless of which tutor was assigned, so he has one place
    // to see the whole business's schedule (see docs/adr/0008).
    // Non-blocking: a Google failure must never fail a booking that has
    // already succeeded.
    try {
      const startDate = new Date(session.scheduledAt);
      const endDate = new Date(startDate.getTime() + session.duration * 60_000);
      const eventId = await insertTutoringEvent({
        bookingId: session.id,
        summary: `KLMathPrep: ${user.email.split("@")[0]} (${session.subject})`,
        description: `Booking ID: ${session.id}\nStudent: ${user.email}`,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        attendeeEmail: user.email,
      });
      await updateSessionGoogleEvent(session.id, {
        googleEventId: eventId || undefined,
        googleEventStatus: eventId ? "synced" : "failed",
      });
    } catch (calendarError) {
      console.error(`Failed to push booking ${session.id} to Google Calendar:`, calendarError);
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    // TransactWriteCommand fails with TransactionCanceledException if slot is taken
    if (
      error.name === "TransactionCanceledException" ||
      error.__type?.includes("TransactionCanceledException")
    ) {
      return NextResponse.json(
        { error: "This time slot is no longer available" },
        { status: 409 }
      );
    }
    console.error("Book session error:", error);
    return NextResponse.json(
      { error: "Failed to book session" },
      { status: 500 }
    );
  }
}

// DELETE - Student cancels their booking
export async function DELETE(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const householdSub = await getHouseholdSub(user.sub);
    if (session.studentSub !== user.sub && session.studentSub !== householdSub) {
      return NextResponse.json(
        { error: "You can only cancel your own bookings" },
        { status: 403 }
      );
    }

    if (session.status !== "scheduled") {
      return NextResponse.json(
        { error: "Can only cancel scheduled sessions" },
        { status: 400 }
      );
    }

    await cancelBooking(sessionId, session.tutorSub, session.scheduledAt);

    // Remove the event from the founder's Tutoring calendar (non-blocking).
    if (session.googleEventId) {
      try {
        await deleteTutoringEvent(session.googleEventId);
      } catch (calendarError) {
        console.error(`Failed to delete Google event for booking ${sessionId}:`, calendarError);
      }
    }

    // Send cancellation email (non-blocking)
    try {
      const recipients = [user.email];
      const profile = await getUserProfile(householdSub);
      if (profile?.parentEmail) {
        recipients.push(profile.parentEmail);
      }
      if (profile?.email && profile.email !== user.email) {
        recipients.push(profile.email);
      }
      const tutors = await listTutors();
      const assignedTutor = tutors.find((t) => t.sub === session.tutorSub);
      if (assignedTutor?.email) {
        recipients.push(assignedTutor.email);
      }

      await sendBookingCancellationEmail({
        to: recipients,
        studentName: user.email.split("@")[0],
        scheduledAt: session.scheduledAt,
        subject: session.subject,
      });
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}

// GET - Student's upcoming bookings
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const householdSub = await getHouseholdSub(user.sub);
    const sessions = await getSessionsByStudent(householdSub);
    const upcoming = sessions.filter(
      (s) =>
        s.status === "scheduled" && new Date(s.scheduledAt) > new Date()
    );

    // Enrich with each session's assigned tutor's meeting room, so the
    // dashboard's "Join Zoom Now" button points at the right room.
    const tutorSubs = Array.from(new Set(upcoming.map((s) => s.tutorSub).filter(Boolean)));
    const tutorProfiles = await Promise.all(tutorSubs.map((sub) => getUserProfile(sub)));
    const meetingRoomBySub = new Map(
      tutorSubs.map((sub, i) => [sub, tutorProfiles[i]?.meetingRoomUrl])
    );
    // Also enrich with the assigned tutor's display name, so the student can
    // see who they were assigned (the pooled system picks automatically —
    // see the "Assignment" glossary entry in CONTEXT.md).
    const tutors = await listTutors();
    const tutorNameBySub = new Map(tutors.map((t) => [t.sub, t.name || t.email]));
    const enriched = upcoming.map((s) => ({
      ...s,
      meetingRoomUrl: meetingRoomBySub.get(s.tutorSub) || undefined,
      tutorName: tutorNameBySub.get(s.tutorSub) || undefined,
    }));

    return NextResponse.json({ bookings: enriched });
  } catch (error: any) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "Failed to get bookings" },
      { status: 500 }
    );
  }
}
