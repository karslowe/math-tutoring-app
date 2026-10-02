import type { TutorIdentity } from "./auth-helpers";

/**
 * Assignment order (ADR-0002, amended by ADR-0009, amended again 2026-09-24):
 * the founder (index 0, the real Cognito account) takes any slot he's free
 * for, full stop — continuity no longer overrides him. Continuity with
 * whoever last taught this household only matters as a tiebreaker among the
 * *other* tutors, once the founder isn't available for the slot. `tutors` is
 * sorted oldest-account-first by listTutors().
 */
export function chooseTutor(
  candidates: Set<string>,
  tutors: TutorIdentity[],
  preferredTutorSub: string | null
): string | null {
  const founder = tutors[0];
  if (founder && candidates.has(founder.sub)) return founder.sub;
  if (preferredTutorSub && candidates.has(preferredTutorSub)) {
    return preferredTutorSub;
  }
  const secondary = tutors.slice(1).find((t) => candidates.has(t.sub));
  if (secondary) return secondary.sub;
  return null;
}

/**
 * For the booking calendar: which tutor the system would assign to each open
 * slot, using the same rule as chooseTutor. Shown to students as a label
 * only; they never pick (ADR-0002).
 */
export function assignTutorsToSlots(
  freeBySlot: Map<string, Set<string>>,
  tutors: TutorIdentity[]
): Record<string, { sub: string; name: string }> {
  const out: Record<string, { sub: string; name: string }> = {};
  for (const [slot, candidates] of Array.from(freeBySlot.entries())) {
    const sub = chooseTutor(candidates, tutors, null);
    const tutor = tutors.find((t) => t.sub === sub);
    if (tutor) out[slot] = { sub: tutor.sub, name: tutor.name || tutor.email };
  }
  return out;
}

/**
 * The student booked a slot labeled with a specific tutor. Honor that tutor
 * while still free; if they've since been taken, refuse instead of silently
 * assigning someone else, so the label the student saw is always true.
 */
export function resolveRequestedTutor(
  requestedTutorSub: string,
  candidates: Set<string>
): { ok: true; tutorSub: string } | { ok: false } {
  return candidates.has(requestedTutorSub)
    ? { ok: true, tutorSub: requestedTutorSub }
    : { ok: false };
}
