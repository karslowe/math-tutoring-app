import { describe, it, expect } from "vitest";
import { chooseTutor } from "../booking-assignment";
import type { TutorIdentity } from "../auth-helpers";

const founder: TutorIdentity = {
  sub: "founder-sub",
  email: "karsten@example.com",
  name: "Karsten",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const second: TutorIdentity = {
  sub: "jason",
  email: "karsten@example.com",
  name: "Jason",
  createdAt: "",
};

const tutors = [founder, second];

describe("chooseTutor", () => {
  it("prefers the founder when both are free and there is no continuity match", () => {
    const candidates = new Set([founder.sub, second.sub]);
    expect(chooseTutor(candidates, tutors, null)).toBe(founder.sub);
  });

  it("falls back to the second tutor when the founder cannot cover the slot", () => {
    const candidates = new Set([second.sub]);
    expect(chooseTutor(candidates, tutors, null)).toBe(second.sub);
  });

  it("returns null when nobody is free", () => {
    const candidates = new Set<string>();
    expect(chooseTutor(candidates, tutors, null)).toBeNull();
  });

  it("prefers the founder even when continuity points to the second tutor", () => {
    const candidates = new Set([founder.sub, second.sub]);
    expect(chooseTutor(candidates, tutors, second.sub)).toBe(founder.sub);
  });

  it("falls back to continuity when the founder cannot cover the slot", () => {
    const candidates = new Set([second.sub]);
    expect(chooseTutor(candidates, tutors, second.sub)).toBe(second.sub);
  });
});
