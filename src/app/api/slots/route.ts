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
import { eachDayOfInterval, parseISO, format } from "date-fns";

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
        new Date(startDate).toISOString(),
        new Date(endDate + "T23:59:59").toISOString()
      ),
    ]);

    const bookedTimes = bookedSessions.map((s) => s.scheduledAt);

    // Generate slots for each day in range
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const allSlots: { date: string; slots: string[] }[] = [];

    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      const windows = getAvailabilityForDate(
        dateStr,
        weeklyAvailability,
        overrides
      );
      const daySlots = generateTimeSlots(dateStr, windows, 60);
      const availableSlots = filterBookedSlots(daySlots, bookedTimes);
      const futureSlots = filterPastSlots(availableSlots);

      if (futureSlots.length > 0) {
        allSlots.push({ date: dateStr, slots: futureSlots });
      }
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
