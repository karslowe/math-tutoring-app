import type { TutorIdentity } from "./auth-helpers";

/**
 * Assignment order (ADR-0002, amended by ADR-0009): prefer continuity with
 * whoever last taught this household; otherwise prefer the founder (index 0,
 * the real Cognito account) so his open hours get filled first, with any
 * other tutor picking up whatever he can't cover. `tutors` is sorted
 * oldest-account-first by listTutors().
 */
export function chooseTutor(
  candidates: Set<string>,
  tutors: TutorIdentity[],
  preferredTutorSub: string | null
): string | null {
  if (preferredTutorSub && candidates.has(preferredTutorSub)) {
    return preferredTutorSub;
  }
  const founder = tutors[0];
  if (founder && candidates.has(founder.sub)) return founder.sub;
  const secondary = tutors.slice(1).find((t) => candidates.has(t.sub));
  if (secondary) return secondary.sub;
  return null;
}
