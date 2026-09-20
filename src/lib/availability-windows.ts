import type { AvailabilitySlot, WeeklyAvailability, DateOverride } from "./dynamodb";

const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Subtract blocked ranges from base windows. Both in HH:MM local times. */
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
 * Client-safe twin of `getAvailabilityForDate` in `slots.ts` — deliberately
 * duplicated, not imported: slots.ts reads `process.env.TUTOR_TIMEZONE` at
 * module scope, which risks a "process is not defined" crash in a browser
 * bundle (only NEXT_PUBLIC_-prefixed vars are safe there). Takes an
 * already tutor-zoned Date (e.g. via date-fns-tz's `toZonedTime`) instead of
 * a timezone string, since every caller already has one.
 */
export function getEffectiveWindowsForDate(
  zonedDate: Date,
  dateStr: string, // YYYY-MM-DD, in the same tutor-zoned terms as zonedDate
  weeklyAvailability: WeeklyAvailability[],
  overrides: DateOverride[]
): AvailabilitySlot[] {
  const dayName = DAYS_OF_WEEK[zonedDate.getDay()];
  const weeklyDay = weeklyAvailability.find((w) => w.sk === dayName);
  const base = weeklyDay?.slots || [];

  const override = overrides.find((o) => o.sk === dateStr);
  const blocked = override?.blockedRanges || [];

  return subtractBlockedRanges(base, blocked);
}
