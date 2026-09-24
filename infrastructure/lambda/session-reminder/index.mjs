import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({});

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "math-tutoring-sessions";
const USERS_TABLE = process.env.USERS_TABLE || "math-tutoring-users";
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const TUTOR_NAME = process.env.TUTOR_NAME || "Your Tutor";
// Fallback only, used if a session's tutor has no profile row (pre-migration data).
const FALLBACK_TUTOR_EMAIL = process.env.TUTOR_EMAIL || "";
const FALLBACK_ZOOM_LINK = process.env.ZOOM_LINK || "";
const TUTOR_TIMEZONE = process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

/**
 * Look up the assigned tutor's own email and meeting room for this session,
 * falling back to the single legacy env vars for any session without a
 * tutorSub (pre-migration) or whose tutor has no profile row yet.
 *
 * Not cached: this Lambda's execution environment stays warm between the
 * 15-minute cron runs, so an in-memory cache here would keep serving a
 * tutor's old email/Zoom link long after they update their profile, until
 * the container happens to cold-start. A GetItem per session is cheap
 * enough that correctness wins over saving it.
 */
async function getTutorContactInfo(tutorSub) {
  if (!tutorSub) {
    return { email: FALLBACK_TUTOR_EMAIL, zoomLink: FALLBACK_ZOOM_LINK };
  }
  const result = await docClient.send(
    new GetCommand({ TableName: USERS_TABLE, Key: { sub: tutorSub } })
  );
  return {
    email: result.Item?.email || FALLBACK_TUTOR_EMAIL,
    zoomLink: result.Item?.meetingRoomUrl || FALLBACK_ZOOM_LINK,
  };
}

/**
 * This Lambda is triggered by EventBridge on a schedule (every 15 minutes).
 * It scans for sessions happening within the next 1 hour that haven't
 * had a reminder sent yet, then sends an email via SES to the student
 * and the tutor.
 */
export async function handler() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 60 * 1000);

  try {
    // Find sessions that are scheduled within the next 1 hour and haven't been reminded
    const result = await docClient.send(
      new ScanCommand({
        TableName: SESSIONS_TABLE,
        FilterExpression:
          "#status = :scheduled AND reminderSent = :false AND scheduledAt BETWEEN :now AND :oneHour",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":scheduled": "scheduled",
          ":false": false,
          ":now": now.toISOString(),
          ":oneHour": oneHourFromNow.toISOString(),
        },
      })
    );

    const sessions = result.Items || [];
    console.log(`Found ${sessions.length} sessions needing reminders`);

    for (const session of sessions) {
      const sessionDate = new Date(session.scheduledAt);
      const formattedDate = sessionDate.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: TUTOR_TIMEZONE,
        timeZoneName: "short",
      });

      const { email: tutorEmail, zoomLink: ZOOM_LINK } = await getTutorContactInfo(
        session.tutorSub
      );

      // Send to student, their assigned tutor, and always the founder
      // (the owner wants visibility into every reminder regardless of
      // which tutor a session is assigned to).
      const recipients = [session.studentEmail];
      if (tutorEmail && !recipients.includes(tutorEmail)) {
        recipients.push(tutorEmail);
      }
      if (FALLBACK_TUTOR_EMAIL && !recipients.includes(FALLBACK_TUTOR_EMAIL)) {
        recipients.push(FALLBACK_TUTOR_EMAIL);
      }

      const studentName = session.studentEmail.split("@")[0];

      // Send reminder email
      await sesClient.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: {
            ToAddresses: recipients.filter(Boolean),
          },
          Message: {
            Subject: {
              Data: `Reminder: KL Math Prep Session in 1 Hour - ${formattedDate}`,
            },
            Body: {
              Html: {
                Data: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f59e0b; padding: 24px; border-radius: 12px 12px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 20px;">⏰ Session Starting Soon!</h1>
                    </div>
                    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                      <p style="color: #374151; margin: 0 0 8px;">Hi there,</p>
                      <p style="color: #6b7280; margin: 0 0 20px;">This is a friendly reminder that a tutoring session is starting in about 1 hour:</p>
                      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                        <p style="color: #374151; margin: 0 0 8px;"><strong>Student:</strong> ${studentName}</p>
                        <p style="color: #374151; margin: 0 0 8px;"><strong>Date &amp; Time:</strong> ${formattedDate}</p>
                        <p style="color: #374151; margin: 0 0 8px;"><strong>Duration:</strong> ${session.duration} minutes</p>
                        <p style="color: #374151; margin: 0;"><strong>Subject:</strong> ${session.subject}</p>${ZOOM_LINK ? `
                        <p style="color: #374151; margin: 8px 0 0;"><strong>Zoom:</strong> <a href="${ZOOM_LINK}" style="color: #2563eb; text-decoration: underline;">${ZOOM_LINK}</a></p>` : ""}
                      </div>${ZOOM_LINK ? `
                      <a href="${ZOOM_LINK}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 0 0 16px;">Join Zoom Meeting</a>` : ""}
                      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">Make sure to upload any materials you'd like to review before the session!</p>
                      <p style="color: #9ca3af; font-size: 13px; margin: 0;">Best,<br/>${TUTOR_NAME}</p>
                    </div>
                  </div>
                `,
              },
              Text: {
                Data: `Reminder: You have a KL Math Prep session in about 1 hour!\n\nStudent: ${studentName}\nDate & Time: ${formattedDate}\nDuration: ${session.duration} min\nSubject: ${session.subject}${ZOOM_LINK ? `\nZoom Link: ${ZOOM_LINK}` : ""}\n\nMake sure to upload any materials beforehand!\n\nBest,\n${TUTOR_NAME}`,
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

      console.log(`Sent reminder for session ${session.id} to ${recipients.join(", ")}`);
    }

    return { statusCode: 200, body: `Processed ${sessions.length} reminders` };
  } catch (error) {
    console.error("Reminder Lambda error:", error);
    throw error;
  }
}
