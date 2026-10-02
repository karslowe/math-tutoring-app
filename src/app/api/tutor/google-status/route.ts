import { NextRequest, NextResponse } from "next/server";
import { requireTutor, listTutors } from "@/lib/auth-helpers";
import { getCalendarHealth } from "@/lib/google-calendar";

// GET - Is each tutor's Google Calendar connected and still working? Drives
// the "needs reconnecting" warning on the tutor schedule page. Only tutors
// with a connected account are reported on, by name.
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tutors = await listTutors();
  const [founder, second] = await Promise.all([
    getCalendarHealth("founder"),
    getCalendarHealth("second"),
  ]);
  return NextResponse.json({
    calendars: [
      { tutor: tutors[0]?.name || "Founder", status: founder },
      ...(tutors[1] ? [{ tutor: tutors[1].name || tutors[1].email, status: second }] : []),
    ],
  });
}
