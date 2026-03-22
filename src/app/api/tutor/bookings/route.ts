import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { getScheduledSessionsByDateRange } from "@/lib/dynamodb";
import { jwtDecode } from "jwt-decode";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "@/lib/aws-config";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
});

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

// GET - Tutor views all booked sessions in a date range
export async function GET(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Verify tutor access
  let hasTutorAccess = false;
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      hasTutorAccess = isTutor(groups);
    } catch {
      hasTutorAccess = false;
    }
  } else {
    hasTutorAccess = user.email === process.env.TUTOR_EMAIL;
  }

  if (!hasTutorAccess) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
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
    const [sessions, usersResponse] = await Promise.all([
      getScheduledSessionsByDateRange(
        startDate + "T00:00:00.000Z",
        endDate + "T23:59:59.999Z"
      ),
      cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
          Limit: 60,
        })
      ),
    ]);

    // Build a map of sub → name
    const nameMap = new Map<string, string>();
    for (const u of usersResponse.Users || []) {
      const attrs = u.Attributes || [];
      const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
      const name = attrs.find((a) => a.Name === "name")?.Value || "";
      if (sub && name) nameMap.set(sub, name);
    }

    // Enrich sessions with student names
    const enrichedSessions = sessions.map((session) => ({
      ...session,
      studentName: nameMap.get(session.studentSub) || "",
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
