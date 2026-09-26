import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { awsConfig } from "./aws-config";
import type { BusyInterval } from "./slots";

const secretsClient = new SecretsManagerClient({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TIMEZONE = "America/Los_Angeles";

interface GoogleSecret {
  google_account: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  tutoring_calendar_id: string;
}

/** The refresh token is dead (Google returned invalid_grant). Do not retry. */
export class GoogleAuthError extends Error {}

class GoogleApiError extends Error {
  status: number;
  reason?: string;
  constructor(status: number, reason: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

// ── Secret + token caching ──
// Mirrors the module-scope cache idiom already used in auth-helpers.ts /
// session-reminder Lambda: cheap for warm invocations, fine to lose on a
// cold start or redeploy since the secret itself rarely changes.

let secretCache: GoogleSecret | null | undefined;

async function getGoogleSecret(): Promise<GoogleSecret | null> {
  if (secretCache !== undefined) return secretCache;
  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: awsConfig.google.secretName })
    );
    secretCache = result.SecretString ? (JSON.parse(result.SecretString) as GoogleSecret) : null;
  } catch (error) {
    console.error("Google Calendar secret not available:", (error as Error).name);
    secretCache = null;
  }
  return secretCache;
}

let accessTokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt - 5 * 60_000) {
    return accessTokenCache.token;
  }

  const secret = await getGoogleSecret();
  if (!secret) throw new GoogleAuthError("Google Calendar secret is not configured");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: secret.client_id,
      client_secret: secret.client_secret,
      refresh_token: secret.refresh_token,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (body.error === "invalid_grant") {
      throw new GoogleAuthError("Google refresh token is no longer valid (invalid_grant)");
    }
    throw new Error(`Google token exchange failed: ${response.status} ${body.error || ""}`);
  }

  accessTokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return accessTokenCache.token;
}

// ── Request helpers ──

async function googleFetch(url: string, init: RequestInit): Promise<any> {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    throw new GoogleApiError(response.status, reason, body?.error?.message || response.statusText);
  }
  return body;
}

/** Exponential backoff on rate limiting only — everything else surfaces immediately. */
async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  const delaysMs = [500, 1500, 3500];
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited =
        error instanceof GoogleApiError &&
        (error.status === 429 || (error.status === 403 && error.reason === "rateLimitExceeded"));
      if (!isRateLimited || attempt >= delaysMs.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

function logGoogleError(context: string, error: unknown): void {
  console.error(
    `${context}:`,
    error instanceof GoogleAuthError ? "invalid_grant (refresh token dead)" : (error as Error).message
  );
}

// ── Freebusy ──
// Enumerates the account's calendars at request time rather than hardcoding
// names, so it self-updates as calendars are added/removed post-migration.

let calendarListCache: { at: number; ids: string[] } | null = null;
const CALENDAR_LIST_CACHE_MS = 15 * 60_000;

async function getFreebusyCalendarIds(tutoringCalendarId: string): Promise<string[]> {
  if (calendarListCache && Date.now() - calendarListCache.at < CALENDAR_LIST_CACHE_MS) {
    return calendarListCache.ids;
  }
  const result = await withBackoff(() =>
    googleFetch(`${CALENDAR_API}/users/me/calendarList?maxResults=250`, { method: "GET" })
  );
  const ids = ((result?.items || []) as { id: string }[])
    .map((c) => c.id)
    .filter((id) => id !== tutoringCalendarId);
  calendarListCache = { at: Date.now(), ids };
  return ids;
}

/**
 * Busy intervals across every calendar on the account except the Tutoring
 * calendar itself (avoids double-counting the app's own bookings).
 *
 * Three-state return, deliberately not just an array:
 *  - `[]` when the feature isn't configured yet (no secret) — booking
 *    behaves exactly as it did before this feature existed, since there's
 *    nothing yet to fail safe *about*.
 *  - `[]` when it's configured and genuinely confirms no conflicts.
 *  - `null` only when it's configured but the check itself failed (dead
 *    token, network error, rate limit exhausted) — callers should fail
 *    closed (treat the founder as busy) here, since this is the "silent
 *    failure" case the whole feature exists to prevent: Google *should* be
 *    reachable and isn't, right now.
 */
export async function getFounderBusyIntervals(
  timeMinISO: string,
  timeMaxISO: string
): Promise<BusyInterval[] | null> {
  const secret = await getGoogleSecret();
  if (!secret) return [];

  try {
    const calendarIds = await getFreebusyCalendarIds(secret.tutoring_calendar_id);
    if (calendarIds.length === 0) return [];

    const result = await withBackoff(() =>
      googleFetch(`${CALENDAR_API}/freeBusy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: timeMinISO,
          timeMax: timeMaxISO,
          items: calendarIds.map((id) => ({ id })),
        }),
      })
    );

    const intervals: BusyInterval[] = [];
    for (const cal of Object.values(result?.calendars || {}) as { busy?: BusyInterval[] }[]) {
      for (const busy of cal.busy || []) {
        intervals.push({ start: busy.start, end: busy.end });
      }
    }
    return intervals;
  } catch (error) {
    logGoogleError("Google freebusy check failed", error);
    return null;
  }
}

// ── Writing sessions ──
// Idempotency uses Calendar's actual mechanism: a client-supplied event id
// (must be lowercase base32hex, 5-1024 chars) rather than a request header.
// A standard UUID's hex characters (0-9a-f) are already a subset of that
// alphabet, so stripping hyphens is enough to make a valid, deterministic id.

export function googleEventIdFor(bookingId: string): string {
  return bookingId.replace(/-/g, "").toLowerCase();
}

export interface InsertEventInput {
  bookingId: string;
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  attendeeEmail?: string;
}

/** Returns the Google event id on success (including "already existed"), or null if the write couldn't be made. */
export async function insertTutoringEvent(input: InsertEventInput): Promise<string | null> {
  const secret = await getGoogleSecret();
  if (!secret) return null;

  const eventId = googleEventIdFor(input.bookingId);
  const body = {
    id: eventId,
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startISO, timeZone: TIMEZONE },
    end: { dateTime: input.endISO, timeZone: TIMEZONE },
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
  };

  try {
    await withBackoff(() =>
      googleFetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(secret.tutoring_calendar_id)}/events?sendUpdates=all`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      )
    );
    return eventId;
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 409) {
      // Retried insert with the same deterministic id — already created.
      return eventId;
    }
    logGoogleError(`Google event insert failed for booking ${input.bookingId}`, error);
    return null;
  }
}

/** Cancellation/reschedule. 404/410 (already gone) count as success. */
export async function deleteTutoringEvent(eventId: string): Promise<boolean> {
  const secret = await getGoogleSecret();
  if (!secret) return false;

  try {
    await withBackoff(() =>
      googleFetch(
        `${CALENDAR_API}/calendars/${encodeURIComponent(secret.tutoring_calendar_id)}/events/${eventId}?sendUpdates=all`,
        { method: "DELETE" }
      )
    );
    return true;
  } catch (error) {
    if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) {
      return true;
    }
    logGoogleError(`Google event delete failed for event ${eventId}`, error);
    return false;
  }
}
