import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, getHouseholdSub, listTutors } from "@/lib/auth-helpers";
import {
  createSession,
  getSessionsByStudent,
  getMostRecentTutorForStudent,
  TutoringSession,
} from "@/lib/dynamodb";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const householdSub = await getHouseholdSub(user.sub);
    const sessions = await getSessionsByStudent(householdSub);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { error: "Failed to get sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const householdSub = await getHouseholdSub(user.sub);

    // NOTE: this endpoint has no frontend caller and bypasses the slot-lock
    // and pooled-assignment logic that /api/bookings uses — it should not be
    // wired up to any UI without going through that same path instead.
    const tutors = await listTutors();
    const tutorSub =
      (await getMostRecentTutorForStudent(householdSub)) || tutors[0]?.sub || "";

    const session: TutoringSession = {
      id: randomUUID(),
      studentSub: householdSub,
      studentEmail: user.email,
      tutorSub,
      scheduledAt: body.scheduledAt,
      duration: body.duration || 60,
      subject: body.subject || "General Math",
      notes: body.notes || "",
      status: "scheduled",
      reminderSent: false,
      createdAt: new Date().toISOString(),
    };

    await createSession(session);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
