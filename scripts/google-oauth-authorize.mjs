// One-time Google OAuth authorization for the KLMathPrep Calendar sync
// (docs/adr/0008). Run once, signed in as karslowe0@gmail.com, after the
// Google Cloud Console prerequisites are done (project created, Calendar
// API enabled, consent screen in Production, Web application OAuth client
// created — see the Phase 1 spec's "Prerequisites" section).
//
// What it does:
//   1. Prints an authorization URL to open in a browser.
//   2. Runs a temporary local HTTP server on the registered redirect_uri to
//      catch the callback and its `code` param.
//   3. Exchanges the code for a refresh token.
//   4. Defaults to PRINTING the resulting secret JSON for you to review.
//      Pass --execute to also write it straight to Secrets Manager.
//
// Usage:
//   node scripts/google-oauth-authorize.mjs \
//     --client-id=<id> --client-secret=<secret> \
//     --tutoring-calendar-id=<calendar id on karslowe0@gmail.com> \
//     [--redirect-uri=http://localhost:8787/callback] [--secret-name=klmathprep/google-calendar] \
//     [--execute]
//
// The redirect_uri passed here must exactly match one registered on the
// OAuth client in Google Cloud Console.

import { createServer } from "node:http";
import { URL } from "node:url";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [key, ...rest] = a.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  })
);

const execute = args.execute === true;
const clientId = args["client-id"];
const clientSecret = args["client-secret"];
const tutoringCalendarId = args["tutoring-calendar-id"];
const redirectUri = args["redirect-uri"] || "http://localhost:8787/callback";
const secretName = args["secret-name"] || "klmathprep/google-calendar";

if (!clientId || !clientSecret || !tutoringCalendarId) {
  console.error(
    "Usage: --client-id=<id> --client-secret=<secret> --tutoring-calendar-id=<id> " +
      "[--redirect-uri=...] [--secret-name=...] [--execute]\n" +
      "Run without --execute first to review the result before it's stored."
  );
  process.exit(1);
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

async function waitForCode(port, pathname) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname !== pathname) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        error
          ? `<p>Authorization failed: ${error}. You can close this tab.</p>`
          : "<p>Authorized. You can close this tab and return to the terminal.</p>"
      );
      server.close();
      if (error) reject(new Error(`Google returned error: ${error}`));
      else if (code) resolve(code);
      else reject(new Error("No code or error in callback"));
    });
    server.listen(port, () => {
      console.log(`\nOpen this URL in a browser signed in as karslowe0@gmail.com:\n`);
      console.log(authUrl.toString());
      console.log(`\nWaiting for the redirect to ${redirectUri} ...`);
    });
    server.on("error", reject);
  });
}

async function exchangeCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(body)}`);
  }
  if (!body.refresh_token) {
    throw new Error(
      "No refresh_token in response. Google only returns one on first consent " +
        "(or with prompt=consent, which this script always sends) — if you've " +
        "already authorized this app before, revoke access at " +
        "https://myaccount.google.com/permissions and try again."
    );
  }
  return body.refresh_token;
}

async function main() {
  const redirectUrl = new URL(redirectUri);
  const port = Number(redirectUrl.port) || 80;
  const code = await waitForCode(port, redirectUrl.pathname);
  const refreshToken = await exchangeCode(code);

  const secretPayload = {
    google_account: "karslowe0@gmail.com",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    tutoring_calendar_id: tutoringCalendarId,
  };

  console.log(`\nMode: ${execute ? "EXECUTE (will write to Secrets Manager)" : "DRY RUN (printing only)"}`);
  console.log(`Secret name: ${secretName}\n`);
  console.log(JSON.stringify(secretPayload, null, 2));

  if (!execute) {
    console.log("\nRe-run with --execute to store this in Secrets Manager.");
    return;
  }

  const region = process.env.AWS_REGION || "us-east-2";
  const client = new SecretsManagerClient({ region });
  const secretString = JSON.stringify(secretPayload);

  try {
    await client.send(
      new CreateSecretCommand({ Name: secretName, SecretString: secretString })
    );
    console.log(`\nCreated secret "${secretName}".`);
  } catch (error) {
    if (error.name !== "ResourceExistsException") throw error;
    await client.send(
      new PutSecretValueCommand({ SecretId: secretName, SecretString: secretString })
    );
    console.log(`\nSecret "${secretName}" already existed — updated its value.`);
  }
}

main().catch((error) => {
  console.error("\nAuthorization failed:", error.message);
  process.exit(1);
});
