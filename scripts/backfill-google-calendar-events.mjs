// One-off backfill: push upcoming, still-scheduled sessions that failed to
// sync to Google Calendar (googleEventStatus: "failed") before the
// math-tutoring-app IAM user had secretsmanager:GetSecretValue on the
// Google Calendar secret. Mirrors the exact insert logic in
// src/app/api/bookings/route.ts / src/lib/google-calendar.ts so the
// resulting events are indistinguishable from a normal live booking.
//
// Default: DRY RUN (lists candidates, touches nothing).
// Pass --execute to actually insert events and update DynamoDB.
//
// Usage: node scripts/backfill-google-calendar-events.mjs [--execute]

import { readFileSync } from "node:fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const execute = process.argv.includes("--execute");

function parseEnvLocal(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = parseEnvLocal("/Users/Git/math-tutoring-app/.env.local");
const region = env.AWS_REGION || "us-east-2";
const credentials = {
  accessKeyId: env.AWS_ACCESS_KEY_ID || env.APP_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY || env.APP_SECRET_ACCESS_KEY,
};
const sessionsTable = env.DYNAMODB_TABLE_SESSIONS || "math-tutoring-sessions";
const secretName = env.GOOGLE_CALENDAR_SECRET_NAME || "klmathprep/google-calendar";
const TIMEZONE = "America/Los_Angeles";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials }));
const secretsClient = new SecretsManagerClient({ region, credentials });

function googleEventIdFor(bookingId) {
  return bookingId.replace(/-/g, "").toLowerCase();
}

async function getGoogleSecret() {
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  return JSON.parse(result.SecretString);
}

async function getAccessToken(secret) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: secret.refresh_token,
      client_id: secret.client_id,
      client_secret: secret.client_secret,
    }),
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function insertTutoringEvent(secret, accessToken, input) {
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
  const response = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(secret.tutoring_calendar_id)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  if (response.status === 409) return eventId; // already exists, deterministic id
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Insert failed: ${response.status} ${JSON.stringify(errBody.error?.message || errBody)}`);
  }
  return eventId;
}

async function main() {
  const nowISO = new Date().toISOString();

  const scan = await ddb.send(
    new ScanCommand({
      TableName: sessionsTable,
      FilterExpression:
        "#status = :scheduled AND googleEventStatus = :failed AND scheduledAt > :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":scheduled": "scheduled",
        ":failed": "failed",
        ":now": nowISO,
      },
    })
  );

  const candidates = (scan.Items || []).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  console.log(`Mode: ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Found ${candidates.length} upcoming scheduled session(s) with googleEventStatus: "failed"\n`);

  for (const s of candidates) {
    console.log(
      `  - ${s.scheduledAt}  |  ${s.subject || "(no subject)"}  |  student: ${s.studentEmail}  |  tutorSub: ${s.tutorSub}  |  id: ${s.id}`
    );
  }

  if (!execute) {
    console.log("\nRe-run with --execute to push these onto the Tutoring calendar and update DynamoDB.");
    return;
  }

  if (candidates.length === 0) return;

  const secret = await getGoogleSecret();
  const accessToken = await getAccessToken(secret);

  console.log("\nInserting events...");
  let succeeded = 0;
  let failed = 0;
  for (const s of candidates) {
    const startDate = new Date(s.scheduledAt);
    const endDate = new Date(startDate.getTime() + s.duration * 60_000);
    try {
      const eventId = await insertTutoringEvent(secret, accessToken, {
        bookingId: s.id,
        summary: `KLMathPrep: ${s.studentEmail.split("@")[0]} (${s.subject})`,
        description: `Booking ID: ${s.id}\nStudent: ${s.studentEmail}`,
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        attendeeEmail: s.studentEmail,
      });
      await ddb.send(
        new UpdateCommand({
          TableName: sessionsTable,
          Key: { id: s.id },
          UpdateExpression: "SET googleEventStatus = :status, googleEventId = :eventId",
          ExpressionAttributeValues: { ":status": "synced", ":eventId": eventId },
        })
      );
      console.log(`  OK    ${s.scheduledAt}  ${s.subject}  (event ${eventId})`);
      succeeded++;
    } catch (error) {
      console.error(`  FAIL  ${s.scheduledAt}  ${s.subject}  -  ${error.message}`);
      failed++;
    }
  }
  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exit(1);
});
