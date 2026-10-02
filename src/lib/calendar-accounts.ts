import type { TutorIdentity } from "./auth-helpers";
import { subtractBusyIntervals } from "./slots";
import type { BusyInterval } from "./slots";
import type { AvailabilitySlot } from "./dynamodb";

/**
 * Which connected Google account a tutor's calendar lives on. Index 0 of
 * `tutors` is the founder (oldest account first, the convention chooseTutor()
 * uses). The second tutor is identified by his configured sub, NOT by
 * position: listTutors() appends him after every real Cognito tutor, and
 * that group also holds a test account, so he is not at index 1. Anyone else
 * has no calendar connected.
 */
export type GoogleAccount = "founder" | "second";

export function googleAccountForTutor(
  tutorSub: string,
  tutors: TutorIdentity[],
  secondTutorSub: string
): GoogleAccount | null {
  if (tutors[0]?.sub === tutorSub) return "founder";
  if (secondTutorSub && tutorSub === secondTutorSub) return "second";
  return null;
}

/**
 * What to do when a tutor's calendar can't be read (dead token, network).
 * The founder fails closed (no slots) as before; the second tutor fails open
 * (keep his weekly hours) so a broken connection doesn't silently remove all
 * of his bookable time — the schedule page warns instead.
 */
export type FailurePolicy = "closed" | "open";

export function failurePolicyFor(account: GoogleAccount): FailurePolicy {
  return account === "founder" ? "closed" : "open";
}

/** Apply a tutor's busy intervals to a day's availability windows. */
export function applyBusyCheck(
  windows: AvailabilitySlot[],
  dateStr: string,
  busy: BusyInterval[] | null,
  policy: FailurePolicy,
  timezone: string,
  bufferMinutes: number
): AvailabilitySlot[] {
  if (busy === null) return policy === "closed" ? [] : windows;
  return subtractBusyIntervals(windows, dateStr, busy, timezone, bufferMinutes);
}
