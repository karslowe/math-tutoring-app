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

const client = new DynamoDBClient({ region: awsConfig.region });
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
  scheduledAt: string; // ISO date
  duration: number; // minutes
  subject: string;
  notes: string;
  topics?: TopicMastery[];
  status: "scheduled" | "completed" | "cancelled";
  reminderSent: boolean;
  createdAt: string;
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

// ── User profile operations ──

export interface UserProfile {
  sub: string;
  email: string;
  displayName: string;
  role: "student" | "tutor";
  parentEmail?: string;
  createdAt: string;
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

// ── Availability operations ──

export interface AvailabilitySlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface WeeklyAvailability {
  pk: "WEEKLY";
  sk: string; // day of week lowercase (monday, tuesday, etc.)
  slots: AvailabilitySlot[];
  updatedAt: string;
}

export interface DateOverride {
  pk: string; // OVERRIDE#YYYY-MM-DD
  sk: string; // YYYY-MM-DD
  available: boolean;
  slots: AvailabilitySlot[];
  updatedAt: string;
}

export async function setWeeklyAvailability(
  dayOfWeek: string,
  slots: AvailabilitySlot[]
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Item: {
        pk: "WEEKLY",
        sk: dayOfWeek.toLowerCase(),
        slots,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getWeeklyAvailability(): Promise<WeeklyAvailability[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "WEEKLY" },
    })
  );
  return (result.Items || []) as WeeklyAvailability[];
}

export async function setDateOverride(
  date: string,
  available: boolean,
  slots: AvailabilitySlot[]
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Item: {
        pk: `OVERRIDE#${date}`,
        sk: date,
        available,
        slots,
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getDateOverrides(
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
        ":prefix": "OVERRIDE#",
        ":start": startDate,
        ":end": endDate,
      },
    })
  );
  return (result.Items || []) as DateOverride[];
}

export async function deleteDateOverride(date: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: awsConfig.dynamodb.availabilityTable,
      Key: { pk: `OVERRIDE#${date}`, sk: date },
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

export async function bookSession(
  session: TutoringSession
): Promise<void> {
  const slotLockId = `SLOT#${session.scheduledAt}`;
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
              id: slotLockId,
              scheduledAt: session.scheduledAt,
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
  scheduledAt: string
): Promise<void> {
  const slotLockId = `SLOT#${scheduledAt}`;
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
            Key: { id: slotLockId },
          },
        },
      ],
    })
  );
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
