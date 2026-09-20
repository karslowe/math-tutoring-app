import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadWithSecondTutor(sub: string | undefined) {
  vi.resetModules();
  if (sub === undefined) {
    delete process.env.NEXT_PUBLIC_SECOND_TUTOR_SUB;
  } else {
    process.env.NEXT_PUBLIC_SECOND_TUTOR_SUB = sub;
  }
  return import("../auth-helpers");
}

describe("resolveActingTutorSub", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("defaults to the caller's own sub when nothing is requested", async () => {
    const { resolveActingTutorSub } = await loadWithSecondTutor("jason");
    expect(resolveActingTutorSub("karsten-sub", null)).toEqual({
      ok: true,
      tutorSub: "karsten-sub",
    });
  });

  it("allows a caller to explicitly request their own sub", async () => {
    const { resolveActingTutorSub } = await loadWithSecondTutor("jason");
    expect(resolveActingTutorSub("karsten-sub", "karsten-sub")).toEqual({
      ok: true,
      tutorSub: "karsten-sub",
    });
  });

  it("allows acting as the configured second tutor", async () => {
    const { resolveActingTutorSub } = await loadWithSecondTutor("jason");
    expect(resolveActingTutorSub("karsten-sub", "jason")).toEqual({
      ok: true,
      tutorSub: "jason",
    });
  });

  it("rejects any sub other than the caller's own or the second tutor's", async () => {
    const { resolveActingTutorSub } = await loadWithSecondTutor("jason");
    const result = resolveActingTutorSub("karsten-sub", "some-other-tutor-sub");
    expect(result.ok).toBe(false);
  });

  it("rejects the second-tutor sub when the feature isn't configured", async () => {
    const { resolveActingTutorSub } = await loadWithSecondTutor(undefined);
    const result = resolveActingTutorSub("karsten-sub", "jason");
    expect(result.ok).toBe(false);
  });
});
