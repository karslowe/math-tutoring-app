/**
 * Appends ?tutorSub= to a request URL for the shared-login "acting as"
 * feature (ADR-0009). Omit tutorSub to act as the caller's own account —
 * the server-side default in every route that accepts this param.
 */
export function withTutorSub(url: string, tutorSub?: string): string {
  if (!tutorSub) return url;
  return `${url}${url.includes("?") ? "&" : "?"}tutorSub=${encodeURIComponent(tutorSub)}`;
}
