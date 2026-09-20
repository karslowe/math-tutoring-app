import { NextRequest, NextResponse } from "next/server";
import {
  extractToken,
  verifyToken,
  requireTutor,
  resolveActingTutorSub,
} from "@/lib/auth-helpers";
import { getWeeklyAvailability, setWeeklyAvailability } from "@/lib/dynamodb";

// GET - Any authenticated user can view a tutor's weekly availability.
// Tutors default to their own; anyone else must pass ?tutorSub=.
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const tutorSub = request.nextUrl.searchParams.get("tutorSub") || user.sub;

  try {
    const availability = await getWeeklyAvailability(tutorSub);
    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error("Get availability error:", error);
    return NextResponse.json(
      { error: "Failed to get availability" },
      { status: 500 }
    );
  }
}

// PUT - Tutor sets weekly availability for a day, for themself or (under the
// shared-login model, ADR-0009) for the second tutor they're acting as via
// ?tutorSub=. resolveActingTutorSub rejects any sub that isn't one of those two.
export async function PUT(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  const acting = resolveActingTutorSub(
    user.sub,
    request.nextUrl.searchParams.get("tutorSub")
  );
  if (!acting.ok) {
    return NextResponse.json({ error: acting.error }, { status: acting.status });
  }

  try {
    const body = await request.json();
    const { dayOfWeek, slots } = body;

    if (!dayOfWeek || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "dayOfWeek and slots are required" },
        { status: 400 }
      );
    }

    const validDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    if (!validDays.includes(dayOfWeek.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid day of week" },
        { status: 400 }
      );
    }

    await setWeeklyAvailability(acting.tutorSub, dayOfWeek.toLowerCase(), slots);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set availability error:", error);
    return NextResponse.json(
      { error: "Failed to set availability" },
      { status: 500 }
    );
  }
}
