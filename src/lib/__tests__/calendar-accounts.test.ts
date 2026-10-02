import { describe, it, expect } from "vitest";
import {
  googleAccountForTutor,
  failurePolicyFor,
  applyBusyCheck,
} from "../calendar-accounts";

const tutors = [
  { sub: "karsten", email: "k@x.com", name: "Karsten", createdAt: "2026-01-01" },
  { sub: "jason", email: "j@x.com", name: "Jason", createdAt: "2026-02-01" },
  { sub: "third", email: "t@x.com", name: "Third", createdAt: "2026-03-01" },
];

describe("googleAccountForTutor", () => {
  it("maps the founder and the second tutor to their own accounts", () => {
    expect(googleAccountForTutor("karsten", tutors)).toBe("founder");
    expect(googleAccountForTutor("jason", tutors)).toBe("second");
  });
  it("has no account for anyone else", () => {
    expect(googleAccountForTutor("third", tutors)).toBeNull();
    expect(googleAccountForTutor("nobody", tutors)).toBeNull();
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
});
