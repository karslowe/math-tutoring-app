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

import { assignTutorsToSlots, resolveRequestedTutor } from "../booking-assignment";

describe("assignTutorsToSlots", () => {
  const tutors = [
    { sub: "karsten", email: "k@x.com", name: "Karsten", createdAt: "2026-01-01" },
    { sub: "jason", email: "j@x.com", name: "Jason", createdAt: "2026-02-01" },
  ];

  it("picks the founder when both are free, otherwise whoever is free", () => {
    const free = new Map<string, Set<string>>([
      ["10:00", new Set(["karsten", "jason"])],
      ["11:00", new Set(["jason"])],
      ["12:00", new Set(["karsten"])],
    ]);
    expect(assignTutorsToSlots(free, tutors)).toEqual({
      "10:00": { sub: "karsten", name: "Karsten" },
      "11:00": { sub: "jason", name: "Jason" },
      "12:00": { sub: "karsten", name: "Karsten" },
    });
  });

  it("omits a slot nobody is free for", () => {
    const free = new Map<string, Set<string>>();
    free.set("10:00", new Set<string>());
    expect(assignTutorsToSlots(free, tutors)).toEqual({});
  });
});

describe("resolveRequestedTutor", () => {
  it("honors the tutor the student saw while that tutor is still free", () => {
    expect(resolveRequestedTutor("jason", new Set(["karsten", "jason"]))).toEqual({
      ok: true,
      tutorSub: "jason",
    });
  });
  it("refuses, rather than swapping tutors, once the shown tutor is taken", () => {
    expect(resolveRequestedTutor("karsten", new Set(["jason"]))).toEqual({ ok: false });
  });
});
