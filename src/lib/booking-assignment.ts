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
