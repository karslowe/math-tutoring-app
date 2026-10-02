import { describe, it, expect } from "vitest";
import { sessionLabel } from "../session-label";

describe("sessionLabel", () => {
  it("formats '<Subject> with <Tutor>'", () => {
    expect(sessionLabel("Algebra 2", "Jason")).toBe("Algebra 2 with Jason");
  });
  it("falls back to the subject when no tutor name is known", () => {
    expect(sessionLabel("Algebra 2", "")).toBe("Algebra 2");
    expect(sessionLabel("Algebra 2", undefined)).toBe("Algebra 2");
  });
  it("falls back to a generic subject when subject is blank", () => {
    expect(sessionLabel("", "Jason")).toBe("Tutoring session with Jason");
  });
});
