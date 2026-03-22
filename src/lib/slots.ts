import { format, parseISO, addMinutes, isBefore, isEqual } from "date-fns";
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

/**
 * Get the effective availability windows for a specific date,
 * considering weekly defaults and date-specific overrides.
 */
export function getAvailabilityForDate(
  dateStr: string, // YYYY-MM-DD
  weeklyAvailability: WeeklyAvailability[],
  overrides: DateOverride[]
): AvailabilitySlot[] {
  // Check for a date-specific override first
  const override = overrides.find((o) => o.sk === dateStr);
  if (override) {
    return override.available ? override.slots : [];
  }

  // Fall back to weekly schedule
  const date = parseISO(dateStr);
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const weeklyDay = weeklyAvailability.find((w) => w.sk === dayName);
  return weeklyDay?.slots || [];
}

/**
 * Break availability windows into discrete time slots of the given duration.
 * Returns ISO datetime strings for each slot start time.
 */
export function generateTimeSlots(
  dateStr: string, // YYYY-MM-DD
  windows: AvailabilitySlot[],
  slotDurationMinutes: number = 60
): string[] {
  const slots: string[] = [];

  for (const window of windows) {
    const [startH, startM] = window.start.split(":").map(Number);
    const [endH, endM] = window.end.split(":").map(Number);

    let current = parseISO(`${dateStr}T${window.start}:00`);
    const windowEnd = parseISO(`${dateStr}T${window.end}:00`);

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
 */
export function filterPastSlots(slots: string[]): string[] {
  const now = new Date();
  return slots.filter((slot) => isBefore(now, parseISO(slot)));
}
