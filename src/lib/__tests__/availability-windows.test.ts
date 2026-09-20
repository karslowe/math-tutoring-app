import { describe, it, expect } from "vitest";
import { getEffectiveWindowsForDate } from "../availability-windows";
import type { WeeklyAvailability, DateOverride } from "../dynamodb";

const weekly: WeeklyAvailability[] = [
  {
    pk: "WEEKLY#founder",
    sk: "monday",
    tutorSub: "founder",
    slots: [{ start: "09:00", end: "17:00" }],
    updatedAt: "",
  },
];

describe("getEffectiveWindowsForDate", () => {
  it("returns the full base window when there's no override for that date", () => {
    const monday = new Date(2026, 0, 5); // a Monday
    const result = getEffectiveWindowsForDate(monday, "2026-01-05", weekly, []);
    expect(result).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("subtracts a blocked range from the base window", () => {
    const monday = new Date(2026, 0, 5);
    const overrides: DateOverride[] = [
      {
        pk: "OVERRIDE#founder#2026-01-05",
        sk: "2026-01-05",
        tutorSub: "founder",
        blockedRanges: [{ start: "12:00", end: "13:00" }],
        updatedAt: "",
      },
    ];
    const result = getEffectiveWindowsForDate(monday, "2026-01-05", weekly, overrides);
    expect(result).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "17:00" },
    ]);
  });

  it("returns no windows for a day with no weekly availability", () => {
    const tuesday = new Date(2026, 0, 6);
    const result = getEffectiveWindowsForDate(tuesday, "2026-01-06", weekly, []);
    expect(result).toEqual([]);
  });

  it("returns no windows when a block-all-day override covers the entire base window", () => {
    const monday = new Date(2026, 0, 5);
    const overrides: DateOverride[] = [
      {
        pk: "OVERRIDE#founder#2026-01-05",
        sk: "2026-01-05",
        tutorSub: "founder",
        blockedRanges: [{ start: "00:00", end: "23:59" }],
        updatedAt: "",
      },
    ];
    const result = getEffectiveWindowsForDate(monday, "2026-01-05", weekly, overrides);
    expect(result).toEqual([]);
  });
});
