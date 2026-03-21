import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { awsConfig } from "./aws-config";

const client = new DynamoDBClient({ region: awsConfig.region });
const docClient = DynamoDBDocumentClient.from(client);

// ── Session / Booking operations ──

export interface TutoringSession {
  id: string;
  studentSub: string;
  studentEmail: string;
  scheduledAt: string; // ISO date
  duration: number; // minutes
  subject: string;
  notes: string;
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
