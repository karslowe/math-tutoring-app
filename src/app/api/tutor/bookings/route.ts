import { NextRequest, NextResponse } from "next/server";
import { requireTutor, listTutors } from "@/lib/auth-helpers";
import { getScheduledSessionsByDateRange } from "@/lib/dynamodb";
import { zonedDateRangeToUtcISO } from "@/lib/slots";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "@/lib/aws-config";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
});
const TUTOR_TIMEZONE = process.env.TUTOR_TIMEZONE || "America/Los_Angeles";

// GET - Tutor views all booked sessions (across both tutors, per ADR-0007) in a date range
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  try {
    const range = zonedDateRangeToUtcISO(startDate, endDate, TUTOR_TIMEZONE);
    const [sessions, usersResponse, tutors] = await Promise.all([
      getScheduledSessionsByDateRange(range.startISO, range.endISO),
      cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
          Limit: 60,
        })
      ),
      listTutors(),
    ]);

    // Build a map of sub → name
    const nameMap = new Map<string, string>();
    for (const u of usersResponse.Users || []) {
      const attrs = u.Attributes || [];
      const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
      const name = attrs.find((a) => a.Name === "name")?.Value || "";
      if (sub && name) nameMap.set(sub, name);
    }
    const tutorNameMap = new Map(
      tutors.map((t) => [t.sub, t.name || t.email])
    );

    // Enrich sessions with student and tutor names
    const enrichedSessions = sessions.map((session) => ({
      ...session,
      studentName: nameMap.get(session.studentSub) || "",
      tutorName: tutorNameMap.get(session.tutorSub) || "",
    }));

    return NextResponse.json({ sessions: enrichedSessions });
  } catch (error: any) {
    console.error("Get tutor bookings error:", error);
    return NextResponse.json(
      { error: "Failed to get bookings" },
      { status: 500 }
    );
  }
}
