import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import {
  createSession,
  getSessionsByStudent,
  getUserProfile,
  TutoringSession,
} from "@/lib/dynamodb";
import { sendSessionNoteEmail } from "@/lib/ses";
import { jwtDecode } from "jwt-decode";
import { randomUUID } from "crypto";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

function verifyTutorAccess(
  idToken: string | null,
  userEmail: string
): boolean {
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      return isTutor(groups);
    } catch {
      return false;
    }
  }
  return userEmail === process.env.TUTOR_EMAIL;
}

// POST - Tutor creates a session note for a student
export async function POST(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!verifyTutorAccess(idToken, user.email)) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { studentSub, studentEmail, subject, notes, topics } = body;

    if (!studentSub || !notes) {
      return NextResponse.json(
        { error: "studentSub and notes are required" },
        { status: 400 }
      );
    }

    const session: TutoringSession = {
      id: randomUUID(),
      studentSub,
      studentEmail: studentEmail || "",
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

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    console.error("Create session note error:", error);
    return NextResponse.json(
      { error: "Failed to create session note" },
      { status: 500 }
    );
  }
}

// GET - Tutor views session notes for a specific student
export async function GET(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!verifyTutorAccess(idToken, user.email)) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  const studentSub = request.nextUrl.searchParams.get("studentSub");
  if (!studentSub) {
    return NextResponse.json(
      { error: "studentSub query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const sessions = await getSessionsByStudent(studentSub);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Get session notes error:", error);
    return NextResponse.json(
      { error: "Failed to get session notes" },
      { status: 500 }
    );
  }
}
