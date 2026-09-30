import { describe, it, expect } from "vitest";
import { busyIntervalsForDate, zonedDateRangeToUtcISO } from "../slots";

const TZ = "America/Los_Angeles"; // UTC-7 (PDT) for the dates used below

describe("busyIntervalsForDate", () => {
  it("returns the local HH:MM window for a busy interval entirely within one day", () => {
    const busy = [{ start: "2026-10-05T20:00:00.000Z", end: "2026-10-05T21:00:00.000Z" }];
    // 20:00-21:00 UTC = 13:00-14:00 PDT
    expect(busyIntervalsForDate("2026-10-05", busy, TZ)).toEqual([
      { start: "13:00", end: "14:00" },
    ]);
  });

  it("clips a multi-day interval to each day it actually touches, instead of dropping it", () => {
    // 2026-10-05 18:00 PDT -> 2026-10-07 09:00 PDT (spans three local days)
    const busy = [{ start: "2026-10-06T01:00:00.000Z", end: "2026-10-07T16:00:00.000Z" }];
    expect(busyIntervalsForDate("2026-10-05", busy, TZ)).toEqual([
      { start: "18:00", end: "23:59" },
    ]);
    expect(busyIntervalsForDate("2026-10-06", busy, TZ)).toEqual([
      { start: "00:00", end: "23:59" },
    ]);
    expect(busyIntervalsForDate("2026-10-07", busy, TZ)).toEqual([
      { start: "00:00", end: "09:00" },
    ]);
  });

  it("returns no windows for a date the interval doesn't touch", () => {
    const busy = [{ start: "2026-10-05T20:00:00.000Z", end: "2026-10-05T21:00:00.000Z" }];
    expect(busyIntervalsForDate("2026-10-06", busy, TZ)).toEqual([]);
  });
});

describe("zonedDateRangeToUtcISO", () => {
  it("covers the full local day, not a naive UTC midnight boundary", () => {
    const { startISO, endISO } = zonedDateRangeToUtcISO("2026-10-05", "2026-10-05", TZ);
    expect(startISO).toBe("2026-10-05T07:00:00.000Z");
    // Naively appending T23:59:59.999Z would stop 7 hours before this.
    expect(endISO).toBe("2026-10-06T06:59:59.999Z");
  });
});
