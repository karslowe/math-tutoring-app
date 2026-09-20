import { describe, it, expect } from "vitest";
import { to12Hour, from12Hour, withHour, withMinute, withMeridiem } from "../time-format";

describe("to12Hour", () => {
  it("converts midnight to 12 AM", () => {
    expect(to12Hour("00:00")).toEqual({ hour: 12, minute: 0, meridiem: "AM" });
  });

  it("converts noon to 12 PM", () => {
    expect(to12Hour("12:00")).toEqual({ hour: 12, minute: 0, meridiem: "PM" });
  });

  it("converts an afternoon time", () => {
    expect(to12Hour("13:30")).toEqual({ hour: 1, minute: 30, meridiem: "PM" });
  });

  it("converts a morning time", () => {
    expect(to12Hour("09:15")).toEqual({ hour: 9, minute: 15, meridiem: "AM" });
  });

  it("converts the last minute of the day", () => {
    expect(to12Hour("23:59")).toEqual({ hour: 11, minute: 59, meridiem: "PM" });
  });
});

describe("from12Hour", () => {
  it("round-trips every hour of the day through to12Hour", () => {
    for (let h = 0; h < 24; h++) {
      const hhmm = `${String(h).padStart(2, "0")}:37`;
      const parts = to12Hour(hhmm);
      expect(from12Hour(parts.hour, parts.minute, parts.meridiem)).toBe(hhmm);
    }
  });

  it("converts 12 AM back to 00:00", () => {
    expect(from12Hour(12, 0, "AM")).toBe("00:00");
  });

  it("converts 12 PM back to 12:00", () => {
    expect(from12Hour(12, 0, "PM")).toBe("12:00");
  });
});

describe("withHour / withMeridiem preserve an off-grid minute", () => {
  // A time picker only offers 5-minute increments, but stored data (or a
  // slot entered before the picker existed) can have an arbitrary minute.
  // Changing the hour or AM/PM must not silently round it away.
  it("preserves a non-5-minute value when the hour changes", () => {
    expect(withHour("09:07", 11)).toBe("11:07");
  });

  it("preserves a non-5-minute value when the meridiem changes", () => {
    expect(withMeridiem("09:07", "PM")).toBe("21:07");
  });

  it("does round the minute when the minute itself is changed", () => {
    expect(withMinute("09:07", 30)).toBe("09:30");
  });
});
