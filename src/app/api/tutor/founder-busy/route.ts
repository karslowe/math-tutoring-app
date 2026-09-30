import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { getFounderBusyIntervals } from "@/lib/google-calendar";
import { zonedDateRangeToUtcISO } from "@/lib/slots";

const TUTOR_TIMEZONE = process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

// GET - Either tutor can see the founder's personal-calendar busy blocks for
// a date range, so the shared schedule view can show *why* a gap in his
// tutoring hours exists (already-subtracted busy time), not just that it
// does. Single consolidated Google account (ADR-0008) — no tutor sub needed.
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const { startISO, endISO } = zonedDateRangeToUtcISO(startDate, endDate, TUTOR_TIMEZONE);
  const busy = await getFounderBusyIntervals(startISO, endISO);

  // null means the check itself failed (dead token, network error) rather
  // than "genuinely free" — pass that distinction through as-is so the UI
  // can show "couldn't check" instead of silently rendering an empty row.
  return NextResponse.json({ busy });
}
