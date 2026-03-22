import { addMinutes, isBefore, isEqual } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type {
  AvailabilitySlot,
  WeeklyAvailability,
  DateOverride,
} from "./dynamodb";

const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DEFAULT_TIMEZONE =
  process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

/**
 * Get the effective availability windows for a specific date,
 * considering weekly defaults and date-specific overrides.
 *
 * Uses the tutor's timezone to determine the correct day of week.
 */
export function getAvailabilityForDate(
  dateStr: string, // YYYY-MM-DD
  weeklyAvailability: WeeklyAvailability[],
  overrides: DateOverride[],
  timezone: string = DEFAULT_TIMEZONE
): AvailabilitySlot[] {
  // Check for a date-specific override first
  const override = overrides.find((o) => o.sk === dateStr);
  if (override) {
    return override.available ? override.slots : [];
  }

  // Interpret the date in the tutor's timezone to get the correct day of week
  // e.g., "2026-03-21" at noon in America/Los_Angeles → correct weekday
  const zonedDate = toZonedTime(
    fromZonedTime(`${dateStr}T12:00:00`, timezone),
    timezone
  );
  const dayName = DAYS_OF_WEEK[zonedDate.getDay()];
  const weeklyDay = weeklyAvailability.find((w) => w.sk === dayName);
  return weeklyDay?.slots || [];
}

/**
 * Break availability windows into discrete time slots of the given duration.
 * Returns ISO UTC datetime strings for each slot start time.
 *
 * Times are interpreted in the tutor's timezone and converted to UTC.
 * e.g., "15:00" in America/Los_Angeles → "2026-03-21T22:00:00.000Z" (PDT, UTC-7)
 */
export function generateTimeSlots(
  dateStr: string, // YYYY-MM-DD
  windows: AvailabilitySlot[],
  slotDurationMinutes: number = 60,
  timezone: string = DEFAULT_TIMEZONE
): string[] {
  const slots: string[] = [];

  for (const window of windows) {
    // Interpret "YYYY-MM-DD HH:MM" as tutor's local time, convert to UTC
    let current = fromZonedTime(`${dateStr}T${window.start}:00`, timezone);
    const windowEnd = fromZonedTime(`${dateStr}T${window.end}:00`, timezone);

    // Ensure the slot end doesn't exceed the window end
    while (true) {
      const slotEnd = addMinutes(current, slotDurationMinutes);
      if (isBefore(windowEnd, slotEnd) && !isEqual(windowEnd, slotEnd)) break;
      slots.push(current.toISOString());
      current = slotEnd;
    }
  }

  return slots;
}

/**
 * Remove already-booked slot times from the list of available slots.
 */
export function filterBookedSlots(
  allSlots: string[],
  bookedTimes: string[]
): string[] {
  const bookedSet = new Set(bookedTimes);
  return allSlots.filter((slot) => !bookedSet.has(slot));
}

/**
 * Filter out slots that are in the past.
 * Both `now` and slot ISO strings are in UTC, so comparison is correct.
 */
export function filterPastSlots(slots: string[]): string[] {
  const now = new Date();
  return slots.filter((slot) => isBefore(now, new Date(slot)));
}
