/**
 * The one place a session's tutor label is formatted, so calendar event
 * titles, email subjects and email bodies all read the same:
 * "<Subject> with <Tutor>".
 */
export function sessionLabel(subject: string, tutorName?: string): string {
  const base = subject?.trim() || (tutorName ? "Tutoring session" : "");
  return tutorName ? `${base} with ${tutorName}` : base;
}
