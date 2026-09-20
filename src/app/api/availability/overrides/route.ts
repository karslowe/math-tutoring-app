import { NextRequest, NextResponse } from "next/server";
import {
  extractToken,
  verifyToken,
  requireTutor,
  resolveActingTutorSub,
} from "@/lib/auth-helpers";
import {
  getDateOverrides,
  setDateOverride,
  deleteDateOverride,
} from "@/lib/dynamodb";

// GET - Any authenticated user can view a tutor's date overrides.
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
  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  try {
    const overrides = await getDateOverrides(tutorSub, startDate, endDate);
    return NextResponse.json({ overrides });
  } catch (error: any) {
    console.error("Get overrides error:", error);
    return NextResponse.json(
      { error: "Failed to get overrides" },
      { status: 500 }
    );
  }
}

// POST - Tutor creates a date override, for themself or (under the
// shared-login model, ADR-0009) for the second tutor via ?tutorSub=.
export async function POST(request: NextRequest) {
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
    const { date, blockedRanges } = body;

    if (!date || !Array.isArray(blockedRanges)) {
      return NextResponse.json(
        { error: "date and blockedRanges are required" },
        { status: 400 }
      );
    }

    await setDateOverride(acting.tutorSub, date, blockedRanges);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set override error:", error);
    return NextResponse.json(
      { error: "Failed to set override" },
      { status: 500 }
    );
  }
}

// DELETE - Tutor removes a date override, for themself or (under the
// shared-login model, ADR-0009) for the second tutor via ?tutorSub=.
export async function DELETE(request: NextRequest) {
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

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { error: "date query parameter is required" },
      { status: 400 }
    );
  }

  try {
    await deleteDateOverride(acting.tutorSub, date);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete override error:", error);
    return NextResponse.json(
      { error: "Failed to delete override" },
      { status: 500 }
    );
  }
}
