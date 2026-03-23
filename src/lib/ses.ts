import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { formatInTimeZone } from "date-fns-tz";
import { awsConfig } from "./aws-config";

const sesClient = new SESClient({ region: awsConfig.region });

const TUTOR_TIMEZONE =
  process.env.TUTOR_TIMEZONE || "America/Los_Angeles";
const ZOOM_LINK = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

function formatEmailDate(isoDate: string): string {
  return formatInTimeZone(
    new Date(isoDate),
    TUTOR_TIMEZONE,
    "EEEE, MMMM d, yyyy"
  );
}

function formatEmailTime(isoDate: string): string {
  return formatInTimeZone(
    new Date(isoDate),
    TUTOR_TIMEZONE,
    "h:mm a zzz"
  );
}

/**
 * Send a session note email to the student (and optionally their parent).
 */
export async function sendSessionNoteEmail({
  to,
  subject,
  notes,
  studentName,
}: {
  to: string[];
  subject: string;
  notes: string;
  studentName: string;
}): Promise<void> {
  const fromEmail = awsConfig.ses.fromEmail;
  if (!fromEmail) {
    console.warn("SES_FROM_EMAIL not configured, skipping email");
    return;
  }

  const validRecipients = to.filter((email) => email && email.includes("@"));
  if (validRecipients.length === 0) {
    console.warn("No valid recipients, skipping email");
    return;
  }

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">KL Math Prep - Session Notes</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;">Hi ${studentName},</p>
        <p style="color: #6b7280; margin: 0 0 20px;">Here are the notes from your recent tutoring session:</p>
        <div style="background: #f9fafb; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px; font-weight: 600;">Subject: ${subject}</p>
          <p style="color: #374151; margin: 0; white-space: pre-wrap; line-height: 1.6;">${notes}</p>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">You can also view this in your <strong>Session History</strong> on the tutoring portal.</p>
      </div>
    </div>
  `;

  const textBody = `KL Math Prep - Session Notes\n\nHi ${studentName},\n\nHere are the notes from your recent tutoring session:\n\nSubject: ${subject}\n\n${notes}\n\nYou can also view this in your Session History on the tutoring portal.`;

  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: validRecipients,
      },
      Message: {
        Subject: {
          Data: `Session Notes: ${subject}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
        },
      },
    })
  );
}

/**
 * Send a booking confirmation email.
 */
export async function sendBookingConfirmationEmail({
  to,
  studentName,
  scheduledAt,
  subject,
}: {
  to: string[];
  studentName: string;
  scheduledAt: string;
  subject: string;
}): Promise<void> {
  const fromEmail = awsConfig.ses.fromEmail;
  if (!fromEmail) return;

  const validRecipients = to.filter((email) => email && email.includes("@"));
  if (validRecipients.length === 0) return;

  const dateStr = formatEmailDate(scheduledAt);
  const timeStr = formatEmailTime(scheduledAt);

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">✅ Session Booked!</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;">Hi ${studentName},</p>
        <p style="color: #6b7280; margin: 0 0 20px;">Your tutoring session has been confirmed:</p>
        <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
          <p style="color: #374151; margin: 0 0 8px;"><strong>Subject:</strong> ${subject}</p>
          <p style="color: #374151; margin: 0 0 8px;"><strong>Date:</strong> ${dateStr}</p>
          <p style="color: #374151; margin: 0;"><strong>Time:</strong> ${timeStr}</p>${ZOOM_LINK ? `
          <p style="color: #374151; margin: 8px 0 0;"><strong>Zoom:</strong> <a href="${ZOOM_LINK}" style="color: #2563eb; text-decoration: underline;">${ZOOM_LINK}</a></p>` : ""}
        </div>${ZOOM_LINK ? `
        <a href="${ZOOM_LINK}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 16px 0;">Join Zoom Meeting</a>` : ""}
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">You can manage your bookings on the tutoring portal.</p>
      </div>
    </div>
  `;

  const textBody = `Session Booked!\n\nHi ${studentName},\n\nYour tutoring session has been confirmed:\n\nSubject: ${subject}\nDate: ${dateStr}\nTime: ${timeStr}${ZOOM_LINK ? `\nZoom Link: ${ZOOM_LINK}` : ""}\n\nYou can manage your bookings on the tutoring portal.`;

  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: validRecipients },
      Message: {
        Subject: { Data: `Session Confirmed: ${subject} - ${dateStr}`, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    })
  );
}

/**
 * Send a booking cancellation email.
 */
export async function sendBookingCancellationEmail({
  to,
  studentName,
  scheduledAt,
  subject,
}: {
  to: string[];
  studentName: string;
  scheduledAt: string;
  subject: string;
}): Promise<void> {
  const fromEmail = awsConfig.ses.fromEmail;
  if (!fromEmail) return;

  const validRecipients = to.filter((email) => email && email.includes("@"));
  if (validRecipients.length === 0) return;

  const dateStr = formatEmailDate(scheduledAt);
  const timeStr = formatEmailTime(scheduledAt);

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Session Cancelled</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;">Hi ${studentName},</p>
        <p style="color: #6b7280; margin: 0 0 20px;">The following tutoring session has been cancelled:</p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
          <p style="color: #374151; margin: 0 0 8px;"><strong>Subject:</strong> ${subject}</p>
          <p style="color: #374151; margin: 0 0 8px;"><strong>Date:</strong> ${dateStr}</p>
          <p style="color: #374151; margin: 0;"><strong>Time:</strong> ${timeStr}</p>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">You can book a new session on the tutoring portal.</p>
      </div>
    </div>
  `;

  const textBody = `Session Cancelled\n\nHi ${studentName},\n\nThe following tutoring session has been cancelled:\n\nSubject: ${subject}\nDate: ${dateStr}\nTime: ${timeStr}\n\nYou can book a new session on the tutoring portal.`;

  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: validRecipients },
      Message: {
        Subject: { Data: `Session Cancelled: ${subject} - ${dateStr}`, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    })
  );
}

/**
 * Send a referral invite email to a potential new student.
 */
export async function sendReferralInviteEmail({
  to,
  referrerName,
  signupUrl,
}: {
  to: string;
  referrerName: string;
  signupUrl: string;
}): Promise<void> {
  const fromEmail = awsConfig.ses.fromEmail;
  if (!fromEmail) return;
  if (!to || !to.includes("@")) return;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #7c3aed; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">You've Been Invited to KL Math Prep!</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;">Hi there,</p>
        <p style="color: #6b7280; margin: 0 0 20px;">${referrerName} thinks you'd enjoy tutoring with KL Math Prep! Sign up using the link below and get a <strong>free session</strong> as a welcome gift.</p>
        <a href="${signupUrl}" style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 0 0 20px;">Sign Up and Get Free Session</a>
        <p style="color: #9ca3af; font-size: 13px; margin: 16px 0 0;">This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
      </div>
    </div>
  `;

  const textBody = `You've been invited to KL Math Prep!\n\n${referrerName} thinks you'd enjoy tutoring with KL Math Prep. Sign up using this link and get a free session:\n\n${signupUrl}\n\nThis invite expires in 7 days.`;

  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `${referrerName} invited you to KL Math Prep - Get a free session!`, Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    })
  );
}

/**
 * Send a notification to the referrer that they earned a free session credit.
 */
export async function sendReferralCreditEmail({
  to,
  referrerName,
  referredStudentName,
}: {
  to: string;
  referrerName: string;
  referredStudentName: string;
}): Promise<void> {
  const fromEmail = awsConfig.ses.fromEmail;
  if (!fromEmail) return;
  if (!to || !to.includes("@")) return;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">You Earned a Free Session!</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;">Hi ${referrerName},</p>
        <p style="color: #6b7280; margin: 0 0 20px;">Great news! ${referredStudentName} just completed their first tutoring session. As a thank you for referring them, you've earned a <strong>free session credit</strong>!</p>
        <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
          <p style="color: #374151; margin: 0;">Your free session credit has been added to your account. Use it next time you book a session!</p>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">Keep referring friends to earn more free sessions!</p>
      </div>
    </div>
  `;

  const textBody = `You Earned a Free Session!\n\nHi ${referrerName},\n\n${referredStudentName} just completed their first tutoring session. You've earned a free session credit!\n\nUse it next time you book a session. Keep referring friends to earn more!`;

  await sesClient.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: "You earned a free session credit!", Charset: "UTF-8" },
        Body: {
          Html: { Data: htmlBody, Charset: "UTF-8" },
          Text: { Data: textBody, Charset: "UTF-8" },
        },
      },
    })
  );
}
