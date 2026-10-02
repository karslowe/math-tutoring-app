import { describe, it, expect } from "vitest";
import {
  googleAccountForTutor,
  failurePolicyFor,
  applyBusyCheck,
} from "../calendar-accounts";

// Matches production: the Cognito "tutors" group holds Karsten plus a test
// account, and Jason (the configured second tutor) is appended after them —
// so he is NOT at index 1.
const tutors = [
  { sub: "karsten", email: "k@x.com", name: "Karsten", createdAt: "2026-01-01" },
  { sub: "studenttest2", email: "t@x.com", name: "studenttest2", createdAt: "2026-01-02" },
  { sub: "jason", email: "j@x.com", name: "Jason", createdAt: "" },
];

describe("googleAccountForTutor", () => {
  it("maps the founder and the configured second tutor to their own accounts", () => {
    expect(googleAccountForTutor("karsten", tutors, "jason")).toBe("founder");
    expect(googleAccountForTutor("jason", tutors, "jason")).toBe("second");
  });
  it("gives nobody else an account, including a tutor sitting at index 1", () => {
    expect(googleAccountForTutor("studenttest2", tutors, "jason")).toBeNull();
    expect(googleAccountForTutor("nobody", tutors, "jason")).toBeNull();
  });
  it("has no second account when no second tutor is configured", () => {
    expect(googleAccountForTutor("jason", tutors, "")).toBeNull();
  });
});

describe("failurePolicyFor", () => {
  it("fails closed for the founder and open for the second tutor", () => {
    expect(failurePolicyFor("founder")).toBe("closed");
    expect(failurePolicyFor("second")).toBe("open");
  });
});

describe("applyBusyCheck", () => {
  const windows = [{ start: "09:00", end: "17:00" }];
  const tz = "America/Los_Angeles";

  it("subtracts busy time when the check worked", () => {
    // 10:00-11:00 PT on 2026-10-06 is 17:00-18:00Z
    const out = applyBusyCheck(
      windows,
      "2026-10-06",
      [{ start: "2026-10-06T17:00:00Z", end: "2026-10-06T18:00:00Z" }],
      "closed",
      tz,
      0
    );
    expect(out).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "11:00", end: "17:00" },
    ]);
  });

  it("when the check failed: closed means no availability, open keeps the hours", () => {
    expect(applyBusyCheck(windows, "2026-10-06", null, "closed", tz, 0)).toEqual([]);
    expect(applyBusyCheck(windows, "2026-10-06", null, "open", tz, 0)).toEqual(windows);
  });

  it("an empty busy list changes nothing", () => {
    expect(applyBusyCheck(windows, "2026-10-06", [], "closed", tz, 0)).toEqual(windows);
  });

  it("removes the real Oct 6 conflict (Capital Fitness, 4-6 PM PT) with the 15 min buffer", () => {
    // Google reported Jason busy 2026-10-06T23:00:00Z -> 2026-10-07T01:00:00Z.
    const out = applyBusyCheck(
      [{ start: "12:00", end: "20:00" }],
      "2026-10-06",
      [{ start: "2026-10-06T23:00:00Z", end: "2026-10-07T01:00:00Z" }],
      "open",
      tz,
      15
    );
    expect(out).toEqual([
      { start: "12:00", end: "15:45" },
      { start: "18:15", end: "20:00" },
    ]);
  });
});
