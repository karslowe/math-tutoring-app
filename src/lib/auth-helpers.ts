import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { jwtDecode } from "jwt-decode";
import { awsConfig } from "./aws-config";
import { getUserProfile } from "./dynamodb";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});

export interface TokenUser {
  sub: string;
  email: string;
  username: string;
  groups: string[];
}

/**
 * Verify a Cognito access token on the server side by calling GetUser.
 * Returns the user info if valid, null if not.
 */
export async function verifyToken(
  accessToken: string
): Promise<TokenUser | null> {
  try {
    const response = await cognitoClient.send(
      new GetUserCommand({ AccessToken: accessToken })
    );

    const attrs = response.UserAttributes || [];
    const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
    const email = attrs.find((a) => a.Name === "email")?.Value || "";

    return {
      sub,
      email,
      username: response.Username || "",
      groups: [], // Groups come from the ID token, not GetUser
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header.
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return authHeader;
}

/**
 * Check if the user is a tutor (in the "tutors" group).
 * For server-side checks, we decode the ID token's groups claim.
 */
export function isTutor(groups: string[]): boolean {
  return groups.includes("tutors");
}

/**
 * Resolve a user to their household's primary sub. If the user is a child
 * linked via a family invite, returns the parent's sub so portal data
 * (bookings, files, sessions, credits, progress) is shared with the parent.
 * Otherwise returns the user's own sub.
 */
export async function getHouseholdSub(userSub: string): Promise<string> {
  const profile = await getUserProfile(userSub);
  return profile?.parentSub || userSub;
}

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

export interface TutorIdentity {
  sub: string;
  email: string;
  name: string;
  createdAt: string; // ISO, from Cognito's UserCreateDate
}

let tutorsCache: { at: number; tutors: TutorIdentity[] } | null = null;
const TUTORS_CACHE_MS = 60_000;

/**
 * ADR-0009: a second tutor who shares the founder's Cognito login rather
 * than having their own account. When configured, this identity is not a
 * real Cognito user — it exists only as a key for DynamoDB rows and as an
 * entry in listTutors() — so a request can never authenticate *as* it, only
 * act on its behalf (see resolveActingTutorSub). Unset by default, which
 * makes the whole shared-login feature inert.
 */
export const SECOND_TUTOR_SUB = process.env.NEXT_PUBLIC_SECOND_TUTOR_SUB || "";
export const SECOND_TUTOR_NAME =
  process.env.NEXT_PUBLIC_SECOND_TUTOR_NAME || "Second Tutor";

/**
 * The "tutors" Cognito group is the authority on who is a tutor — the
 * DynamoDB profile's `role` field is never actually set to "tutor" anywhere
 * in this codebase, so it cannot be used to enumerate tutors.
 *
 * Sorted oldest-account-first: index 0 is the founding tutor, which is what
 * booking assignment (see /api/bookings) uses to prefer the founder first
 * (ADR-0009). If a second tutor is configured (SECOND_TUTOR_SUB) it is
 * appended after that sort, not part of it — so it can never end up at index
 * 0 even though it has no real Cognito UserCreateDate to sort by.
 */
export async function listTutors(): Promise<TutorIdentity[]> {
  if (tutorsCache && Date.now() - tutorsCache.at < TUTORS_CACHE_MS) {
    return tutorsCache.tutors;
  }

  const response = await cognitoClient.send(
    new ListUsersInGroupCommand({
      UserPoolId: awsConfig.cognito.userPoolId,
      GroupName: "tutors",
      Limit: 60,
    })
  );

  const tutors = (response.Users || [])
    .map((u) => {
      const attrs = u.Attributes || [];
      return {
        sub: attrs.find((a) => a.Name === "sub")?.Value || "",
        email: attrs.find((a) => a.Name === "email")?.Value || "",
        name: attrs.find((a) => a.Name === "name")?.Value || "",
        createdAt: u.UserCreateDate ? u.UserCreateDate.toISOString() : "",
      };
    })
    .filter((t) => t.sub)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (SECOND_TUTOR_SUB) {
    tutors.push({
      sub: SECOND_TUTOR_SUB,
      // Shares the founder's inbox (see ADR-0009) rather than having his own.
      email: tutors[0]?.email || "",
      name: SECOND_TUTOR_NAME,
      createdAt: "",
    });
  }

  tutorsCache = { at: Date.now(), tutors };
  return tutors;
}

export type ActingTutorResult =
  | { ok: true; tutorSub: string }
  | { ok: false; status: 403; error: string };

/**
 * Under the shared-login model (ADR-0009), the caller's own Cognito sub is
 * not necessarily whose schedule they mean to edit — Karsten and Jason both
 * authenticate as the same account. `requested` is untrusted client input
 * (a query param), so it may only ever resolve to the caller's own sub or
 * the configured second-tutor identity, never anything else.
 */
export function resolveActingTutorSub(
  callerSub: string,
  requested: string | null
): ActingTutorResult {
  if (!requested || requested === callerSub) {
    return { ok: true, tutorSub: callerSub };
  }
  if (SECOND_TUTOR_SUB && requested === SECOND_TUTOR_SUB) {
    return { ok: true, tutorSub: requested };
  }
  return { ok: false, status: 403, error: "Cannot act as that tutor" };
}

export type TutorAuthResult =
  | { ok: true; user: TokenUser }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verifies a request comes from an authenticated tutor. This replaces the
 * duplicated per-route pattern of checking the ID token's cognito:groups
 * claim, with a fallback to `user.email === process.env.TUTOR_EMAIL` — that
 * fallback only ever recognized a single hardcoded address, so it silently
 * locked out any tutor added after the founder. The fallback here instead
 * checks the live "tutors" group membership, so it keeps working as tutors
 * are added or removed.
 */
export async function requireTutor(request: {
  headers: { get(name: string): string | null };
}): Promise<TutorAuthResult> {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return { ok: false, status: 401, error: "Invalid token" };
  }

  const idToken = request.headers.get("x-id-token");
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      if (isTutor(groups)) {
        return { ok: true, user: { ...user, groups } };
      }
      return { ok: false, status: 403, error: "Tutor access required" };
    } catch {
      return { ok: false, status: 401, error: "Invalid ID token" };
    }
  }

  const tutors = await listTutors();
  const isTutorEmail = tutors.some(
    (t) => t.email.toLowerCase() === user.email.toLowerCase()
  );
  return isTutorEmail
    ? { ok: true, user }
    : { ok: false, status: 403, error: "Tutor access required" };
}
