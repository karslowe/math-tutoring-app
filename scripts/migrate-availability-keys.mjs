// One-off migration: rekey the availability table from global (pk="WEEKLY",
// pk="OVERRIDE#<date>") to per-tutor (pk="WEEKLY#<tutorSub>",
// pk="OVERRIDE#<tutorSub>#<date>"). See docs/adr/0001.
//
// DynamoDB partition keys are immutable, so this writes a new item under the
// new key and deletes the old one — it does not update in place.
//
// Defaults to a dry run — it only prints what it would change. Pass
// --execute to actually write.
//
// Usage:
//   node -r dotenv/config scripts/migrate-availability-keys.mjs dotenv_config_path=.env.local -- --founding-tutor-sub=<sub>
//   node -r dotenv/config scripts/migrate-availability-keys.mjs dotenv_config_path=.env.local -- --founding-tutor-sub=<sub> --execute

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
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
const availabilityTable =
  process.env.DYNAMODB_TABLE_AVAILABILITY || "math-tutoring-availability";

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function main() {
  console.log(`Region: ${region}`);
  console.log(`Table: ${availabilityTable}`);
  console.log(`Founding tutor sub: ${foundingTutorSub}`);
  console.log(`Mode: ${execute ? "EXECUTE (will write)" : "DRY RUN (no writes)"}`);
  console.log("");

  const result = await docClient.send(
    new ScanCommand({ TableName: availabilityTable })
  );
  const items = result.Items || [];

  let weeklyCount = 0;
  let overrideCount = 0;
  let alreadyMigrated = 0;
  let unrecognized = 0;

  for (const item of items) {
    const pk = item.pk;

    if (pk === "WEEKLY") {
      weeklyCount++;
      const newItem = {
        ...item,
        pk: `WEEKLY#${foundingTutorSub}`,
        tutorSub: foundingTutorSub,
      };
      console.log(
        `${execute ? "Migrating" : "Would migrate"}: WEEKLY/${item.sk} -> WEEKLY#${foundingTutorSub}/${item.sk}`
      );
      if (execute) {
        await docClient.send(new PutCommand({ TableName: availabilityTable, Item: newItem }));
        await docClient.send(
          new DeleteCommand({ TableName: availabilityTable, Key: { pk: item.pk, sk: item.sk } })
        );
      }
    } else if (typeof pk === "string" && pk.startsWith("OVERRIDE#") && !pk.includes(foundingTutorSub)) {
      // Old shape: OVERRIDE#<date>. (New shape already contains the tutor sub.)
      const isOldShape = pk.split("#").length === 2;
      if (!isOldShape) {
        alreadyMigrated++;
        continue;
      }
      overrideCount++;
      const date = item.sk;
      const newPk = `OVERRIDE#${foundingTutorSub}#${date}`;
      const newItem = { ...item, pk: newPk, tutorSub: foundingTutorSub };
      console.log(
        `${execute ? "Migrating" : "Would migrate"}: ${pk}/${item.sk} -> ${newPk}/${item.sk}`
      );
      if (execute) {
        await docClient.send(new PutCommand({ TableName: availabilityTable, Item: newItem }));
        await docClient.send(
          new DeleteCommand({ TableName: availabilityTable, Key: { pk: item.pk, sk: item.sk } })
        );
      }
    } else if (typeof pk === "string" && pk.startsWith(`WEEKLY#`)) {
      alreadyMigrated++;
    } else {
      unrecognized++;
      console.log(`Unrecognized row, leaving alone: pk=${pk} sk=${item.sk}`);
    }
  }

  console.log("");
  console.log(`Scanned: ${items.length}`);
  console.log(`Weekly rows ${execute ? "migrated" : "to migrate"}: ${weeklyCount}`);
  console.log(`Override rows ${execute ? "migrated" : "to migrate"}: ${overrideCount}`);
  console.log(`Already migrated: ${alreadyMigrated}`);
  console.log(`Unrecognized (untouched): ${unrecognized}`);

  if (!execute && weeklyCount + overrideCount > 0) {
    console.log("\nThis was a dry run — no writes were made. Re-run with --execute to apply.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
