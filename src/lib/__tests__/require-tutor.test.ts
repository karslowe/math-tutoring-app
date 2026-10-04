import { describe, it, expect, afterEach, vi } from "vitest";

// Cognito is the only thing that can vouch for a token's signature. Mock the
// SDK so GetUser accepts whatever access token the test hands it (standing in
// for "Cognito verified this token"), and ListUsersInGroup returns no tutors.
const send = vi.fn();
vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({ send })),
  GetUserCommand: vi.fn((input) => ({ kind: "GetUser", input })),
  ListUsersInGroupCommand: vi.fn((input) => ({ kind: "ListUsersInGroup", input })),
}));
vi.mock("../dynamodb", () => ({ getUserProfile: vi.fn() }));

function unsignedJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.`;
}

function request(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } };
}

function cognitoAccepts() {
  send.mockImplementation(async (cmd: { kind: string }) => {
    if (cmd.kind === "GetUser") {
      return {
        Username: "student",
        UserAttributes: [
          { Name: "sub", Value: "student-sub" },
          { Name: "email", Value: "student@example.com" },
        ],
      };
    }
    return { Users: [] };
  });
}

describe("requireTutor", () => {
  afterEach(() => {
    send.mockReset();
  });

  it("rejects a student who forges an x-id-token claiming the tutors group", async () => {
    cognitoAccepts();
    const { requireTutor } = await import("../auth-helpers");
    const result = await requireTutor(
      request({
        authorization: `Bearer ${unsignedJwt({ sub: "student-sub" })}`,
        "x-id-token": unsignedJwt({ sub: "student-sub", "cognito:groups": ["tutors"] }),
      })
    );
    expect(result).toEqual({ ok: false, status: 403, error: "Tutor access required" });
  });

  it("accepts a tutor whose Cognito-verified access token carries the tutors group", async () => {
    cognitoAccepts();
    const { requireTutor } = await import("../auth-helpers");
    const result = await requireTutor(
      request({
        authorization: `Bearer ${unsignedJwt({ sub: "tutor-sub", "cognito:groups": ["tutors"] })}`,
      })
    );
    expect(result.ok).toBe(true);
  });
});
