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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Subtract blocked ranges from base windows. Both are in HH:MM tutor-local times.
 * Returns remaining availability windows.
 */
function subtractBlockedRanges(
  base: AvailabilitySlot[],
  blocked: AvailabilitySlot[]
): AvailabilitySlot[] {
  if (blocked.length === 0) return base;

  const blockedMin = blocked
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .sort((a, b) => a.start - b.start);

  const result: AvailabilitySlot[] = [];

  for (const window of base) {
    let segments: { start: number; end: number }[] = [
      { start: toMinutes(window.start), end: toMinutes(window.end) },
    ];

    for (const b of blockedMin) {
      const next: { start: number; end: number }[] = [];
      for (const s of segments) {
        if (b.end <= s.start || b.start >= s.end) {
          next.push(s);
        } else {
          if (b.start > s.start) next.push({ start: s.start, end: b.start });
          if (b.end < s.end) next.push({ start: b.end, end: s.end });
        }
      }
      segments = next;
    }

    for (const s of segments) {
      if (s.end > s.start) {
        result.push({ start: toHHMM(s.start), end: toHHMM(s.end) });
      }
    }
  }

  return result;
}

/**
 * Get the effective availability windows for a specific date,
 * taking weekly base hours and subtracting any blocked ranges.
 *
 * Uses the tutor's timezone to determine the correct day of week.
 */
export function getAvailabilityForDate(
  dateStr: string, // YYYY-MM-DD
  weeklyAvailability: WeeklyAvailability[],
  overrides: DateOverride[],
  timezone: string = DEFAULT_TIMEZONE
): AvailabilitySlot[] {
  // Interpret the date in the tutor's timezone to get the correct day of week
  const zonedDate = toZonedTime(
    fromZonedTime(`${dateStr}T12:00:00`, timezone),
    timezone
  );
  const dayName = DAYS_OF_WEEK[zonedDate.getDay()];
  const weeklyDay = weeklyAvailability.find((w) => w.sk === dayName);
  const base = weeklyDay?.slots || [];

  const override = overrides.find((o) => o.sk === dateStr);
  const blocked = override?.blockedRanges || [];

  return subtractBlockedRanges(base, blocked);
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
