import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { awsConfig } from "./aws-config";

const client = new DynamoDBClient({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});
const docClient = DynamoDBDocumentClient.from(client);

// ── Topic Mastery ──

export type MasteryLevel = "Learning" | "Practicing" | "Getting It" | "Mastered";

export interface TopicMastery {
  name: string;
  level: MasteryLevel;
}

export const MASTERY_LEVELS: Record<MasteryLevel, number> = {
  Learning: 1,
  Practicing: 2,
  "Getting It": 3,
  Mastered: 4,
};

// ── Session / Booking operations ──

export interface TutoringSession {
  id: string;
  studentSub: string;
  studentEmail: string;
  tutorSub: string;
  scheduledAt: string; // ISO date
  duration: number; // minutes
  subject: string;
  notes: string;
  topics?: TopicMastery[];
  paidWithCredit?: boolean;
  status: "scheduled" | "completed" | "cancelled";
  reminderSent: boolean;
  createdAt: string;
  googleEventId?: string;
  googleEventStatus?: "synced" | "failed";
}

export async function createSession(
  session: TutoringSession
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      Item: session,
    })
  );
}

export async function getSessionsByStudent(
  studentSub: string
): Promise<TutoringSession[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      IndexName: "studentSub-scheduledAt-index",
      KeyConditionExpression: "studentSub = :sub",
      ExpressionAttributeValues: { ":sub": studentSub },
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as TutoringSession[];
}

export async function getSession(id: string): Promise<TutoringSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      Key: { id },
    })
  );
  return (result.Item as TutoringSession) || null;
}

export async function updateSessionStatus(
  id: string,
  status: TutoringSession["status"]
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      Key: { id },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
    })
  );
}

/**
 * Attaches session notes to an already-booked, still-scheduled session
 * instead of creating a second, disconnected record — so tutor-history
 * attribution comes from whichever tutor the pooled-booking system actually
 * assigned (`tutorSub`, untouched here), not from whoever happens to be
 * logged in when the notes get written up afterward. The ConditionExpression
 * also stops the same booking from being logged twice.
 */
export async function completeSessionWithNotes(
  id: string,
  updates: { subject: string; notes: string; topics: TopicMastery[] }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      Key: { id },
      UpdateExpression:
        "SET #status = :completed, subject = :subject, notes = :notes, topics = :topics",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":completed": "completed",
        ":scheduled": "scheduled",
        ":subject": updates.subject,
        ":notes": updates.notes,
        ":topics": updates.topics,
      },
      ConditionExpression: "#status = :scheduled",
    })
  );
}

export async function updateSessionGoogleEvent(
  id: string,
  update: { googleEventId?: string; googleEventStatus: TutoringSession["googleEventStatus"] }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      Key: { id },
      UpdateExpression: "SET googleEventStatus = :status" + (update.googleEventId ? ", googleEventId = :eventId" : ""),
      ExpressionAttributeValues: {
        ":status": update.googleEventStatus,
        ...(update.googleEventId ? { ":eventId": update.googleEventId } : {}),
      },
    })
  );
}

// ── User profile operations ──

export interface UserProfile {
  sub: string;
  email: string;
  displayName: string;
  role: "student" | "tutor";
  parentEmail?: string;
  parentSub?: string;
  parentName?: string;
  phone?: string;
  freeSessionCredits?: number;
  referredBy?: string;
  surveyCompleted?: boolean;
  surveySubject?: string;
  surveyGoal?: string;
  createdAt: string;
  // Tutor-only fields (role === "tutor"). Populated via /api/tutor/profile.
  photoUrl?: string;
  bio?: string;
  meetingRoomUrl?: string;
}

export async function upsertUserProfile(
  profile: UserProfile
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Item: profile,
    })
  );
}

export async function getUserProfile(
  sub: string
): Promise<UserProfile | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
    })
  );
  return (result.Item as UserProfile) || null;
}

/**
 * Sets a tutor's meeting room URL (ADR-0004) in a single round trip, rather
 * than reading the profile back just to spread it into a full overwrite.
 * `if_not_exists` fills in displayName/createdAt only the first time this
 * identity gets a profile row at all — including a synthetic second-tutor
 * sub (ADR-0009) that has no signup flow of its own to have created one.
 */
export async function upsertTutorMeetingRoom(
  sub: string,
  fields: { email: string; displayName: string; meetingRoomUrl: string }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression:
        "SET email = :email, #role = :role, meetingRoomUrl = :url, " +
        "createdAt = if_not_exists(createdAt, :now), " +
        "displayName = if_not_exists(displayName, :displayName)",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: {
        ":email": fields.email,
        ":role": "tutor",
        ":url": fields.meetingRoomUrl,
        ":now": new Date().toISOString(),
        ":displayName": fields.displayName,
      },
    })
  );
}

export async function updateParentEmail(
  sub: string,
  parentEmail: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression: "SET parentEmail = :parentEmail",
      ExpressionAttributeValues: { ":parentEmail": parentEmail },
    })
  );
}

export async function updateUserPhone(
  sub: string,
  phone: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression: "SET phone = :phone",
      ExpressionAttributeValues: { ":phone": phone },
    })
  );
}

export async function updateParentLink(
  studentSub: string,
  parentSub: string,
  parentEmail: string,
  parentName?: string
): Promise<void> {
  const updates = parentName
    ? "SET parentSub = :psub, parentEmail = :pemail, parentName = :pname"
    : "SET parentSub = :psub, parentEmail = :pemail";
  const values: Record<string, string> = {
    ":psub": parentSub,
    ":pemail": parentEmail,
  };
  if (parentName) values[":pname"] = parentName;

  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub: studentSub },
      UpdateExpression: updates,
      ExpressionAttributeValues: values,
    })
  );
}

export async function updateSurvey(
  sub: string,
  surveySubject: string,
  surveyGoal: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression:
        "SET surveySubject = :subject, surveyGoal = :goal, surveyCompleted = :true",
      ExpressionAttributeValues: {
        ":subject": surveySubject,
        ":goal": surveyGoal,
        ":true": true,
      },
    })
  );
}

// ── Availability operations ──

export interface AvailabilitySlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface WeeklyAvailability {
  pk: string; // WEEKLY#{tutorSub}
  sk: string; // day of week lowercase (monday, tuesday, etc.)
  tutorSub: string;
  slots: AvailabilitySlot[];
  updatedAt: string;
}

export interface DateOverride {
  pk: string; // OVERRIDE#{tutorSub}#YYYY-MM-DD
  sk: string; // YYYY-MM-DD
  tutorSub: string;
  blockedRanges: AvailabilitySlot[];
  updatedAt: string;
}

export async function setWeeklyAvailability(
  tutorSub: string,
  dayOfWeek: string,
  slots: AvailabilitySlot[]
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Item: {
        pk: `WEEKLY#${tutorSub}`,
        sk: dayOfWeek.toLowerCase(),
        tutorSub,
        slots,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getWeeklyAvailability(
  tutorSub: string
): Promise<WeeklyAvailability[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `WEEKLY#${tutorSub}` },
    })
  );
  return (result.Items || []) as WeeklyAvailability[];
}

export async function setDateOverride(
  tutorSub: string,
  date: string,
  blockedRanges: AvailabilitySlot[]
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Item: {
        pk: `OVERRIDE#${tutorSub}#${date}`,
        sk: date,
        tutorSub,
        blockedRanges,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getDateOverrides(
  tutorSub: string,
  startDate: string,
  endDate: string
): Promise<DateOverride[]> {
  // Scan for overrides in range — low volume so scan is fine
  const result = await docClient.send(
    new ScanCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      FilterExpression:
        "begins_with(pk, :prefix) AND sk BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":prefix": `OVERRIDE#${tutorSub}#`,
        ":start": startDate,
        ":end": endDate,
      },
    })
  );
  return (result.Items || []) as DateOverride[];
}

export async function deleteDateOverride(
  tutorSub: string,
  date: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Key: { pk: `OVERRIDE#${tutorSub}#${date}`, sk: date },
    })
  );
}

// ── Booking operations ──

export async function getScheduledSessionsByDateRange(
  startDate: string,
  endDate: string
): Promise<TutoringSession[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.sessionsTable,
      IndexName: "status-scheduledAt-index",
      KeyConditionExpression:
        "#status = :status AND scheduledAt BETWEEN :start AND :end",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "scheduled",
        ":start": startDate,
        ":end": endDate,
      },
    })
  );
  return (result.Items || []) as TutoringSession[];
}

// Slot locks are scoped per tutor: SLOT#{tutorSub}#{scheduledAt}. Two tutors
// can hold the same start time simultaneously; a tutor cannot double-book themself.
function slotLockId(tutorSub: string, scheduledAt: string): string {
  return `SLOT#${tutorSub}#${scheduledAt}`;
}

export async function bookSession(
  session: TutoringSession
): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: awsConfig.dynamodb.sessionsTable,
            Item: session,
          },
        },
        {
          Put: {
            TableName: awsConfig.dynamodb.sessionsTable,
            Item: {
              id: slotLockId(session.tutorSub, session.scheduledAt),
              scheduledAt: session.scheduledAt,
              tutorSub: session.tutorSub,
              studentSub: session.studentSub,
              studentEmail: session.studentEmail,
              status: "slot-lock",
              createdAt: session.createdAt,
            },
            ConditionExpression: "attribute_not_exists(id)",
          },
        },
      ],
    })
  );
}

export async function cancelBooking(
  sessionId: string,
  tutorSub: string,
  scheduledAt: string
): Promise<void> {
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: awsConfig.dynamodb.sessionsTable,
            Key: { id: sessionId },
            UpdateExpression: "SET #status = :status",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":status": "cancelled" },
          },
        },
        {
          Delete: {
            TableName: awsConfig.dynamodb.sessionsTable,
            Key: { id: slotLockId(tutorSub, scheduledAt) },
          },
        },
      ],
    })
  );
}

/**
 * The tutor who most recently taught this household, if any — the most
 * recent non-cancelled session that has already happened. Used to prefer
 * continuity when assigning a pooled booking.
 */
export async function getMostRecentTutorForStudent(
  studentSub: string
): Promise<string | null> {
  const sessions = await getSessionsByStudent(studentSub); // sorted newest scheduledAt first
  const now = new Date();
  const lastTaught = sessions.find(
    (s) => s.tutorSub && s.status !== "cancelled" && new Date(s.scheduledAt) <= now
  );
  return lastTaught?.tutorSub || null;
}

// ── Topic progress operations ──

export interface TopicProgressEntry {
  topicName: string;
  level: MasteryLevel;
  numericLevel: number;
  date: string;
  sessionId: string;
}

export interface TopicSummary {
  topicName: string;
  currentLevel: MasteryLevel;
  numericLevel: number;
  history: TopicProgressEntry[];
}

export async function getTopicProgressByStudent(
  studentSub: string
): Promise<TopicSummary[]> {
  const sessions = await getSessionsByStudent(studentSub);

  // Filter to completed sessions with topics, sorted by date
  const sessionsWithTopics = sessions
    .filter((s) => s.status === "completed" && s.topics && s.topics.length > 0)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

  // Build topic history
  const topicMap = new Map<string, TopicProgressEntry[]>();

  for (const session of sessionsWithTopics) {
    for (const topic of session.topics!) {
      const entry: TopicProgressEntry = {
        topicName: topic.name,
        level: topic.level,
        numericLevel: MASTERY_LEVELS[topic.level],
        date: session.scheduledAt,
        sessionId: session.id,
      };
      if (!topicMap.has(topic.name)) {
        topicMap.set(topic.name, []);
      }
      topicMap.get(topic.name)!.push(entry);
    }
  }

  // Build summaries
  const summaries: TopicSummary[] = [];
  const topicNames = Array.from(topicMap.keys());
  for (const topicName of topicNames) {
    const history = topicMap.get(topicName)!;
    const latest = history[history.length - 1];
    summaries.push({
      topicName,
      currentLevel: latest.level,
      numericLevel: latest.numericLevel,
      history,
    });
  }

  return summaries.sort((a, b) => a.topicName.localeCompare(b.topicName));
}

// ── Referral operations ──

export type ReferralStatus = "pending" | "signed_up" | "credit_awarded";

export interface Referral {
  token: string;
  referrerSub: string;
  referrerEmail: string;
  invitedEmail: string;
  status: ReferralStatus;
  createdAt: string;
  expiresAt: string;
  redeemedBySub?: string;
  redeemedAt?: string;
  creditAwardedAt?: string;
}

export async function createReferral(referral: Referral): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      Item: referral,
    })
  );
}

export async function getReferral(token: string): Promise<Referral | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      Key: { token },
    })
  );
  return (result.Item as Referral) || null;
}

export async function getReferralsByReferrer(
  referrerSub: string
): Promise<Referral[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      IndexName: "referrerSub-createdAt-index",
      KeyConditionExpression: "referrerSub = :sub",
      ExpressionAttributeValues: { ":sub": referrerSub },
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as Referral[];
}

export async function getReferralByInvitedEmail(
  email: string
): Promise<Referral | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      IndexName: "invitedEmail-index",
      KeyConditionExpression: "invitedEmail = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  const items = (result.Items || []) as Referral[];
  return items.length > 0 ? items[0] : null;
}

export async function updateReferralRedeemed(
  token: string,
  redeemedBySub: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      Key: { token },
      UpdateExpression:
        "SET #status = :status, redeemedBySub = :sub, redeemedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "signed_up",
        ":sub": redeemedBySub,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "#status = :pending",
    })
  );
}

export async function updateReferralCreditAwarded(
  token: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.referralsTable,
      Key: { token },
      UpdateExpression:
        "SET #status = :status, creditAwardedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "credit_awarded",
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "#status = :signedUp",
    })
  );
}

// ── Free session credit operations ──

/**
 * Initialize a brand-new user profile only if no item exists for this sub.
 * Uses a conditional PutItem so concurrent callers don't clobber each other —
 * specifically guards against the family-invite redeem and credits route both
 * trying to create the profile at first login.
 */
export async function ensureUserProfile(
  profile: UserProfile
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: awsConfig.dynamodb.usersTable,
        Item: profile,
        // `sub` is a DynamoDB reserved word, so alias it.
        ConditionExpression: "attribute_not_exists(#sub)",
        ExpressionAttributeNames: { "#sub": "sub" },
      })
    );
  } catch (err: any) {
    if (
      err.name === "ConditionalCheckFailedException" ||
      err.__type?.includes("ConditionalCheckFailedException")
    ) {
      // Profile already exists — that's fine, just return.
      return;
    }
    throw err;
  }
}

export async function incrementFreeSessionCredits(
  sub: string,
  amount: number = 1
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression: "ADD freeSessionCredits :amount",
      ExpressionAttributeValues: { ":amount": amount },
    })
  );
}

export async function decrementFreeSessionCredit(
  sub: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.usersTable,
      Key: { sub },
      UpdateExpression: "SET freeSessionCredits = freeSessionCredits - :one",
      ExpressionAttributeValues: { ":one": 1, ":zero": 0 },
      ConditionExpression: "freeSessionCredits > :zero",
    })
  );
}

// ── Family invitation operations (parent → student linking) ──

export type FamilyInvitationStatus = "pending" | "accepted";

export interface FamilyInvitation {
  token: string;
  parentSub: string;
  parentEmail: string;
  parentName?: string;
  invitedStudentEmail: string;
  status: FamilyInvitationStatus;
  createdAt: string;
  expiresAt: string;
  redeemedBySub?: string;
  redeemedAt?: string;
}

export async function createFamilyInvitation(
  invite: FamilyInvitation
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.familyInvitationsTable,
      Item: invite,
    })
  );
}

export async function getFamilyInvitation(
  token: string
): Promise<FamilyInvitation | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: awsConfig.dynamodb.familyInvitationsTable,
      Key: { token },
    })
  );
  return (result.Item as FamilyInvitation) || null;
}

export async function getFamilyInvitationsByParent(
  parentSub: string
): Promise<FamilyInvitation[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.familyInvitationsTable,
      IndexName: "parentSub-createdAt-index",
      KeyConditionExpression: "parentSub = :sub",
      ExpressionAttributeValues: { ":sub": parentSub },
      ScanIndexForward: false,
    })
  );
  return (result.Items || []) as FamilyInvitation[];
}

export async function getFamilyInvitationByInvitedEmail(
  email: string
): Promise<FamilyInvitation | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.familyInvitationsTable,
      IndexName: "invitedStudentEmail-index",
      KeyConditionExpression: "invitedStudentEmail = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      Limit: 1,
    })
  );
  const items = (result.Items || []) as FamilyInvitation[];
  return items.length > 0 ? items[0] : null;
}

export async function markFamilyInvitationAccepted(
  token: string,
  redeemedBySub: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: awsConfig.dynamodb.familyInvitationsTable,
      Key: { token },
      UpdateExpression:
        "SET #status = :accepted, redeemedBySub = :sub, redeemedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":accepted": "accepted",
        ":sub": redeemedBySub,
        ":now": new Date().toISOString(),
        ":pending": "pending",
      },
      ConditionExpression: "#status = :pending",
    })
  );
}
