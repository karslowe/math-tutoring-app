import { NextRequest, NextResponse } from "next/server";
import { requireTutor, resolveActingTutorSub, SECOND_TUTOR_NAME } from "@/lib/auth-helpers";
import { getUserProfile, upsertTutorMeetingRoom } from "@/lib/dynamodb";

// GET - Tutor views a profile (meeting room, etc.) — their own by default,
// or (under the shared-login model, ADR-0009) the second tutor's via
// ?tutorSub=.
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const acting = resolveActingTutorSub(
    auth.user.sub,
    request.nextUrl.searchParams.get("tutorSub")
  );
  if (!acting.ok) {
    return NextResponse.json({ error: acting.error }, { status: acting.status });
  }

  try {
    const profile = await getUserProfile(acting.tutorSub);
    return NextResponse.json({
      meetingRoomUrl: profile?.meetingRoomUrl || "",
    });
  } catch (error: any) {
    console.error("Get tutor profile error:", error);
    return NextResponse.json(
      { error: "Failed to get tutor profile" },
      { status: 500 }
    );
  }
}

// PUT - Sets a fixed meeting room URL (ADR-0004) — the caller's own by
// default, or (under the shared-login model, ADR-0009) the second tutor's
// via ?tutorSub=. resolveActingTutorSub rejects any other identity.
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
    const { meetingRoomUrl } = body;

    if (typeof meetingRoomUrl !== "string") {
      return NextResponse.json(
        { error: "meetingRoomUrl is required" },
        { status: 400 }
      );
    }

    await upsertTutorMeetingRoom(acting.tutorSub, {
      email: user.email,
      displayName:
        acting.tutorSub === user.sub ? user.email.split("@")[0] : SECOND_TUTOR_NAME,
      meetingRoomUrl: meetingRoomUrl.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set tutor profile error:", error);
    return NextResponse.json(
      { error: "Failed to save tutor profile" },
      { status: 500 }
    );
  }
}
