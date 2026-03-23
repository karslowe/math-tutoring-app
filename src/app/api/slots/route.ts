import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
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
} from "@/lib/slots";
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
  const endDate = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch all data in parallel
    const [weeklyAvailability, overrides, bookedSessions] = await Promise.all([
      getWeeklyAvailability(),
      getDateOverrides(startDate, endDate),
      getScheduledSessionsByDateRange(
        startDate + "T00:00:00.000Z",
        endDate + "T23:59:59.999Z"
      ),
    ]);

    const bookedTimes = bookedSessions.map((s) => s.scheduledAt);

    // Generate date strings for each day in range (timezone-aware)
    const start = new Date(startDate + "T12:00:00Z"); // noon UTC to avoid date boundary issues
    const end = new Date(endDate + "T12:00:00Z");

    const allSlots: { date: string; slots: string[] }[] = [];

    let current = start;
    while (current <= end) {
      // Format the date in the tutor's timezone to get the correct YYYY-MM-DD
      const dateStr = formatInTimeZone(current, TUTOR_TIMEZONE, "yyyy-MM-dd");

      const windows = getAvailabilityForDate(
        dateStr,
        weeklyAvailability,
        overrides,
        TUTOR_TIMEZONE
      );
      const daySlots = generateTimeSlots(
        dateStr,
        windows,
        60,
        TUTOR_TIMEZONE
      );
      const availableSlots = filterBookedSlots(daySlots, bookedTimes);
      const futureSlots = filterPastSlots(availableSlots);

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
