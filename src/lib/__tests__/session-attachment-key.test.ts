import { describe, it, expect } from "vitest";
import { isSessionAttachmentKey } from "../s3";

describe("isSessionAttachmentKey", () => {
  const p = "students/stu-1/sessions/sess-1/";
  it("accepts a file directly in the session folder", () => {
    expect(isSessionAttachmentKey(`${p}123-work.pdf`, "stu-1", "sess-1")).toBe(true);
  });
  it("rejects another session, another student, nested paths and the bare prefix", () => {
    expect(isSessionAttachmentKey("students/stu-1/sessions/sess-2/a.pdf", "stu-1", "sess-1")).toBe(false);
    expect(isSessionAttachmentKey("students/stu-2/sessions/sess-1/a.pdf", "stu-1", "sess-1")).toBe(false);
    expect(isSessionAttachmentKey(`${p}sub/a.pdf`, "stu-1", "sess-1")).toBe(false);
    expect(isSessionAttachmentKey(p, "stu-1", "sess-1")).toBe(false);
  });
});
