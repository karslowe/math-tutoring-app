import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "math-tutoring-sessions";
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const TUTOR_NAME = process.env.TUTOR_NAME || "Your Tutor";

/**
 * This Lambda is triggered by EventBridge on a schedule (every 30 minutes).
 * It scans for sessions happening within the next 6 hours that haven't
 * had a reminder sent yet, then sends an email via SES.
 */
export async function handler() {
  const now = new Date();
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  try {
    // Find sessions that are scheduled within the next 6 hours and haven't been reminded
    const result = await docClient.send(
      new ScanCommand({
        TableName: SESSIONS_TABLE,
        FilterExpression:
          "#status = :scheduled AND reminderSent = :false AND scheduledAt BETWEEN :now AND :sixHours",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":scheduled": "scheduled",
          ":false": false,
          ":now": now.toISOString(),
          ":sixHours": sixHoursFromNow.toISOString(),
        },
      })
    );

    const sessions = result.Items || [];
    console.log(`Found ${sessions.length} sessions needing reminders`);

    for (const session of sessions) {
      const sessionDate = new Date(session.scheduledAt);
      const formattedDate = sessionDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      // Send reminder email
      await sesClient.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: {
            ToAddresses: [session.studentEmail],
          },
          Message: {
            Subject: {
              Data: `Reminder: Math Tutoring Session - ${formattedDate}`,
            },
            Body: {
              Html: {
                Data: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1d4ed8;">Session Reminder</h2>
                    <p>Hi there,</p>
                    <p>This is a friendly reminder that you have a math tutoring session coming up:</p>
                    <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
                      <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
                      <p style="margin: 4px 0;"><strong>Duration:</strong> ${session.duration} minutes</p>
                      <p style="margin: 4px 0;"><strong>Subject:</strong> ${session.subject}</p>
                    </div>
                    <p>Make sure to upload any materials you'd like to review before the session!</p>
                    <p>Best,<br/>${TUTOR_NAME}</p>
                  </div>
                `,
              },
              Text: {
                Data: `Reminder: You have a math tutoring session on ${formattedDate} (${session.duration} min, ${session.subject}). Make sure to upload any materials beforehand!`,
              },
            },
          },
        })
      );

      // Mark reminder as sent
      await docClient.send(
        new UpdateCommand({
          TableName: SESSIONS_TABLE,
          Key: { id: session.id },
          UpdateExpression: "SET reminderSent = :true",
          ExpressionAttributeValues: { ":true": true },
        })
      );

      console.log(`Sent reminder for session ${session.id} to ${session.studentEmail}`);
    }

    return { statusCode: 200, body: `Processed ${sessions.length} reminders` };
  } catch (error) {
    console.error("Reminder Lambda error:", error);
    throw error;
  }
}
