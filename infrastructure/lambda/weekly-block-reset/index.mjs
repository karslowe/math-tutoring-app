import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const AVAILABILITY_TABLE =
  process.env.AVAILABILITY_TABLE || "math-tutoring-availability";
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const TUTOR_EMAIL = process.env.TUTOR_EMAIL || "";
const TUTOR_TIMEZONE = process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

/**
 * Triggered by EventBridge every Thursday at 6am tutor time.
 * Deletes all OVERRIDE# entries in the availability table, then
 * emails the tutor to remind them to re-block for the upcoming week.
 */
export async function handler() {
  try {
    const scan = await docClient.send(
      new ScanCommand({
        TableName: AVAILABILITY_TABLE,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "OVERRIDE#" },
      })
    );

    const overrides = scan.Items || [];
    console.log(`Deleting ${overrides.length} overrides`);

    for (const item of overrides) {
      await docClient.send(
        new DeleteCommand({
          TableName: AVAILABILITY_TABLE,
          Key: { pk: item.pk, sk: item.sk },
        })
      );
    }

    if (FROM_EMAIL && TUTOR_EMAIL) {
      const now = new Date();
      const rangeEnd = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000);
      const rangeStr = `${now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: TUTOR_TIMEZONE,
      })} – ${rangeEnd.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: TUTOR_TIMEZONE,
      })}`;

      await sesClient.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [TUTOR_EMAIL] },
          Message: {
            Subject: {
              Data: `Weekly blocks cleared — set blocks for ${rangeStr}`,
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Charset: "UTF-8",
                Data: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f59e0b; padding: 24px; border-radius: 12px 12px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 20px;">Weekly Blocks Reset</h1>
                    </div>
                    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                      <p style="color: #374151; margin: 0 0 12px;">Your blocks for the previous week have been cleared.</p>
                      <p style="color: #374151; margin: 0 0 20px;">Head to the <strong>Block Off Next 2 Weeks</strong> tab and set your blocks for <strong>${rangeStr}</strong> before students start booking.</p>
                      <p style="color: #9ca3af; font-size: 13px; margin: 0;">${overrides.length} block entr${overrides.length === 1 ? "y" : "ies"} cleared.</p>
                    </div>
                  </div>
                `,
              },
              Text: {
                Charset: "UTF-8",
                Data: `Weekly Blocks Reset\n\nYour blocks for the previous week have been cleared.\n\nSet your blocks for ${rangeStr} in the Block Off Next 2 Weeks tab before students start booking.\n\n${overrides.length} block entries cleared.`,
              },
            },
          },
        })
      );
    }

    return {
      statusCode: 200,
      body: `Cleared ${overrides.length} overrides`,
    };
  } catch (error) {
    console.error("Weekly block reset error:", error);
    throw error;
  }
}
