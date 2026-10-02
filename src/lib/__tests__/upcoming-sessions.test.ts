import { describe, it, expect } from "vitest";
import { upcomingSessions, groupSessionsByDay } from "../upcoming-sessions";

const s = (id: string, scheduledAt: string, duration = 60, status = "scheduled") => ({
  id,
  scheduledAt,
  duration,
  status,
});

describe("upcomingSessions", () => {
  const now = new Date("2026-10-06T23:20:00Z"); // 4:20 PM PT

  it("drops sessions that have already ended", () => {
    const out = upcomingSessions([s("past", "2026-10-06T21:00:00Z")], now);
    expect(out).toEqual([]);
  });

  it("keeps a session that started but has not ended yet", () => {
    // 4:00-5:00 PM PT is in progress at 4:20
    const out = upcomingSessions([s("live", "2026-10-06T23:00:00Z")], now);
    expect(out.map((x) => x.id)).toEqual(["live"]);
  });

  it("drops a session at the exact moment it ends", () => {
    const out = upcomingSessions([s("edge", "2026-10-06T22:20:00Z")], now);
    expect(out).toEqual([]);
  });

  it("ignores cancelled and completed sessions", () => {
    const out = upcomingSessions(
      [s("c", "2026-10-07T00:00:00Z", 60, "cancelled"), s("d", "2026-10-07T01:00:00Z", 60, "completed")],
      now
    );
    expect(out).toEqual([]);
  });

  it("sorts soonest first", () => {
    const out = upcomingSessions(
      [s("later", "2026-10-09T00:00:00Z"), s("sooner", "2026-10-07T00:00:00Z")],
      now
    );
    expect(out.map((x) => x.id)).toEqual(["sooner", "later"]);
  });
});

describe("groupSessionsByDay", () => {
  it("groups by Pacific calendar day, keeping order", () => {
    const groups = groupSessionsByDay(
      [
        s("a", "2026-10-07T00:30:00Z"), // Oct 6, 5:30 PM PT
        s("b", "2026-10-07T03:00:00Z"), // Oct 6, 8:00 PM PT
        s("c", "2026-10-07T16:00:00Z"), // Oct 7, 9:00 AM PT
      ],
      "America/Los_Angeles"
    );
    expect(groups.map((g) => g.label)).toEqual(["Tuesday, Oct 6", "Wednesday, Oct 7"]);
    expect(groups[0].sessions.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
