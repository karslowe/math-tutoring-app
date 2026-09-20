import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, listTutors } from "@/lib/auth-helpers";
import {
  getWeeklyAvailability,
  getDateOverrides,
  getScheduledSessionsByDateRange,
} from "@/lib/dynamodb";
import {
  getAvailabilityForDate,
  generateTimeSlots,
  filterBookedSlots,
  filterPastSlots,
  subtractBusyIntervals,
} from "@/lib/slots";
import { getFounderBusyIntervals } from "@/lib/google-calendar";
import { awsConfig } from "@/lib/aws-config";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const TUTOR_TIMEZONE =
  process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

// GET - Returns available 1-hour slots for a date range
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const requestedEnd = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !requestedEnd) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  // Clamp end date to 14 days from today (inclusive) — students may only book 2 weeks ahead.
  const maxEnd = formatInTimeZone(
    addDays(new Date(), 14),
    TUTOR_TIMEZONE,
    "yyyy-MM-dd"
  );
  const endDate = requestedEnd < maxEnd ? requestedEnd : maxEnd;

  try {
    const tutors = await listTutors();
    if (tutors.length === 0) {
      return NextResponse.json({ days: [] });
    }

    // Fetch all data in parallel, per tutor
    const [tutorData, bookedSessions] = await Promise.all([
      Promise.all(
        tutors.map(async (tutor) => ({
          tutorSub: tutor.sub,
          weeklyAvailability: await getWeeklyAvailability(tutor.sub),
          overrides: await getDateOverrides(tutor.sub, startDate, endDate),
        }))
      ),
      getScheduledSessionsByDateRange(
        startDate + "T00:00:00.000Z",
        endDate + "T23:59:59.999Z"
      ),
    ]);

    // Founder tutor's real-world calendars (School, Personal, RA duty, etc.)
    // filter his candidacy — see docs/adr/0008. `tutors` is oldest-account-
    // first, so index 0 is the founder, same convention /api/bookings uses.
    // If the check fails, treat him as busy the whole window rather than
    // silently offering slots during something the check couldn't see.
    const founderSub = tutors[0].sub;
    const founderBusy = await getFounderBusyIntervals(
      startDate + "T00:00:00.000Z",
      endDate + "T23:59:59.999Z"
    );

    // Generate date strings for each day in range (timezone-aware)
    const start = new Date(startDate + "T12:00:00Z"); // noon UTC to avoid date boundary issues
    const end = new Date(endDate + "T12:00:00Z");

    const allSlots: { date: string; slots: string[] }[] = [];

    let current = start;
    while (current <= end) {
      // Format the date in the tutor's timezone to get the correct YYYY-MM-DD
      const dateStr = formatInTimeZone(current, TUTOR_TIMEZONE, "yyyy-MM-dd");

      // A time is bookable if AT LEAST ONE tutor is free at that time —
      // students never choose a tutor, so slots are a union across tutors.
      const dayFreeTimes = new Set<string>();
      for (const t of tutorData) {
        let windows = getAvailabilityForDate(
          dateStr,
          t.weeklyAvailability,
          t.overrides,
          TUTOR_TIMEZONE
        );
        if (t.tutorSub === founderSub) {
          windows = founderBusy
            ? subtractBusyIntervals(
                windows,
                dateStr,
                founderBusy,
                TUTOR_TIMEZONE,
                awsConfig.google.bufferMinutes
              )
            : [];
        }
        const daySlots = generateTimeSlots(dateStr, windows, 60, TUTOR_TIMEZONE);
        const bookedTimesForTutor = bookedSessions
          .filter((s) => s.tutorSub === t.tutorSub)
          .map((s) => s.scheduledAt);
        const availableSlots = filterBookedSlots(daySlots, bookedTimesForTutor);
        for (const slot of availableSlots) dayFreeTimes.add(slot);
      }

      const futureSlots = filterPastSlots(Array.from(dayFreeTimes)).sort();

      if (futureSlots.length > 0) {
        allSlots.push({ date: dateStr, slots: futureSlots });
      }

      current = addDays(current, 1);
    }

    return NextResponse.json({ days: allSlots });
  } catch (error: any) {
    console.error("Get slots error:", error);
    return NextResponse.json(
      { error: "Failed to compute available slots" },
      { status: 500 }
    );
  }
}
