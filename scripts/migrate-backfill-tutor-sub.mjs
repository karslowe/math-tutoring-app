// One-off migration: stamp `tutorSub` onto every existing session row.
//
// Before the two-tutor expansion, TutoringSession had no tutorSub field at
// all — every session was implicitly taught by the founding tutor. This
// backfill makes that assumption explicit and correct (see docs/adr/0001).
//
// Defaults to a dry run — it only prints what it would change. Pass
// --execute to actually write.
//
// Usage:
//   node -r dotenv/config scripts/migrate-backfill-tutor-sub.mjs dotenv_config_path=.env.local -- --founding-tutor-sub=<sub>
//   node -r dotenv/config scripts/migrate-backfill-tutor-sub.mjs dotenv_config_path=.env.local -- --founding-tutor-sub=<sub> --execute
//
// The founding tutor's sub is `910b2510-2071-70d6-27b2-60c4692fac15`
// (karstenmathprep@gmail.com), confirmed via:
//   aws cognito-idp list-users-in-group --user-pool-id <pool> --group-name tutors --region us-east-2

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const tutorSubArg = args.find((a) => a.startsWith("--founding-tutor-sub="));
const foundingTutorSub = tutorSubArg?.split("=")[1];

if (!foundingTutorSub) {
  console.error(
    "Usage: --founding-tutor-sub=<cognito-sub> [--execute]\n" +
      "Run without --execute first to see what would change."
  );
  process.exit(1);
}

const region = process.env.AWS_REGION || "us-east-2";
const sessionsTable =
  process.env.DYNAMODB_TABLE_SESSIONS || "math-tutoring-sessions";

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function main() {
  console.log(`Region: ${region}`);
  console.log(`Table: ${sessionsTable}`);
  console.log(`Founding tutor sub: ${foundingTutorSub}`);
  console.log(`Mode: ${execute ? "EXECUTE (will write)" : "DRY RUN (no writes)"}`);
  console.log("");

  let lastKey;
  let scanned = 0;
  let toUpdate = 0;
  let skippedSlotLocks = 0;
  let alreadySet = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: sessionsTable,
        ExclusiveStartKey: lastKey,
      })
    );
    lastKey = result.LastEvaluatedKey;

    for (const item of result.Items || []) {
      scanned++;

      // Slot-lock rows (id starts with "SLOT#") are transient booking locks,
      // not sessions — skip them. They'll be recreated per-tutor going forward.
      if (typeof item.id === "string" && item.id.startsWith("SLOT#")) {
        skippedSlotLocks++;
        continue;
      }

      if (item.tutorSub) {
        alreadySet++;
        continue;
      }

      toUpdate++;
      console.log(
        `${execute ? "Updating" : "Would update"}: session ${item.id} ` +
          `(student ${item.studentEmail || item.studentSub}, ${item.scheduledAt})`
      );

      if (execute) {
        await docClient.send(
          new UpdateCommand({
            TableName: sessionsTable,
            Key: { id: item.id },
            UpdateExpression: "SET tutorSub = :tutorSub",
            ConditionExpression: "attribute_not_exists(tutorSub)",
            ExpressionAttributeValues: { ":tutorSub": foundingTutorSub },
          })
        );
      }
    }
  } while (lastKey);

  console.log("");
  console.log(`Scanned: ${scanned}`);
  console.log(`Slot-lock rows skipped: ${skippedSlotLocks}`);
  console.log(`Already had tutorSub: ${alreadySet}`);
  console.log(`${execute ? "Updated" : "Would update"}: ${toUpdate}`);

  if (!execute && toUpdate > 0) {
    console.log("\nThis was a dry run — no writes were made. Re-run with --execute to apply.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
