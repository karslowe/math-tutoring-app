import { formatInTimeZone } from "date-fns-tz";

interface SessionLike {
  scheduledAt: string;
  duration: number; // minutes
  status: string;
}

/**
 * Sessions that haven't finished yet, soonest first. A session stays in the
 * list until it ends (so one in progress is still findable), and cancelled or
 * completed sessions never appear.
 */
export function upcomingSessions<T extends SessionLike>(
  sessions: T[],
  now: Date
): T[] {
  return sessions
    .filter((s) => {
      if (s.status !== "scheduled") return false;
      const end = new Date(s.scheduledAt).getTime() + s.duration * 60_000;
      return end > now.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
}

/** Group an already-sorted list by calendar day in the given timezone. */
export function groupSessionsByDay<T extends { scheduledAt: string }>(
  sessions: T[],
  timeZone: string
): { dateKey: string; label: string; sessions: T[] }[] {
  const groups: { dateKey: string; label: string; sessions: T[] }[] = [];
  for (const session of sessions) {
    const at = new Date(session.scheduledAt);
    const dateKey = formatInTimeZone(at, timeZone, "yyyy-MM-dd");
    let group = groups[groups.length - 1];
    if (!group || group.dateKey !== dateKey) {
      group = {
        dateKey,
        label: formatInTimeZone(at, timeZone, "EEEE, MMM d"),
        sessions: [],
      };
      groups.push(group);
    }
    group.sessions.push(session);
  }
  return groups;
}
