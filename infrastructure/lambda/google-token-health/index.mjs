import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const secretsClient = new SecretsManagerClient({});
const sesClient = new SESClient({});

const SECRET_NAME =
  process.env.GOOGLE_CALENDAR_SECRET_NAME || "klmathprep/google-calendar";
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const TUTOR_EMAILS = (process.env.TUTOR_EMAILS || process.env.TUTOR_EMAIL || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function alert(subject, message) {
  console.error(subject, message);
  if (!FROM_EMAIL || TUTOR_EMAILS.length === 0) return;
  await sesClient.send(
    new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: TUTOR_EMAILS },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Text: { Data: message, Charset: "UTF-8" } },
      },
    })
  );
}

/**
 * Triggered by EventBridge daily. Exchanges the stored Google refresh token
 * for an access token so an expired/revoked grant (invalid_grant) surfaces
 * here — via email — before a student hits it through a silent freebusy or
 * booking failure. See docs/adr/0008 and docs/adr/0005 for why this matters:
 * while the OAuth app is in Testing publishing status refresh tokens expire
 * after 7 days, so a daily check catches that well before it bites.
 */
export async function handler() {
  let secret;
  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: SECRET_NAME })
    );
    secret = result.SecretString ? JSON.parse(result.SecretString) : null;
  } catch (error) {
    await alert(
      "Google Calendar: secret unreadable",
      `Could not load secret "${SECRET_NAME}": ${error.name} ${error.message}`
    );
    throw error;
  }

  if (!secret) {
    await alert(
      "Google Calendar: secret missing",
      `Secret "${SECRET_NAME}" has no value.`
    );
    return { statusCode: 200, body: "No secret configured" };
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: secret.client_id,
      client_secret: secret.client_secret,
      refresh_token: secret.refresh_token,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (body.error === "invalid_grant") {
      await alert(
        "Google Calendar: refresh token dead (invalid_grant)",
        "The stored refresh token for karslowe0@gmail.com no longer works. " +
          "Check the OAuth consent screen's publishing status is still Production " +
          "(Testing tokens expire after 7 days), then re-run " +
          "scripts/google-oauth-authorize.mjs --execute to get a new one. " +
          "Booking and freebusy checks are failing closed in the meantime."
      );
      return { statusCode: 200, body: "invalid_grant" };
    }
    await alert(
      "Google Calendar: token health check failed",
      `Token exchange failed: ${response.status} ${body.error || ""}`
    );
    return { statusCode: 200, body: `error: ${body.error || response.status}` };
  }

  console.log("Google Calendar token health check OK");
  return { statusCode: 200, body: "OK" };
}
