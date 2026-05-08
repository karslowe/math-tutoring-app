import { NextRequest, NextResponse } from "next/server";
import { getHouseholdSub } from "@/lib/auth-helpers";
import {
  getUserProfile,
  getFamilyInvitationByInvitedEmail,
} from "@/lib/dynamodb";
import {
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { awsConfig } from "@/lib/aws-config";

// TEMP diagnostic endpoint — local-dev only. Looks up a profile by email
// (NOT by access token) so you can inspect parentSub from a browser tab.
// Remove before deploying to production.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "Pass ?email=<address> in the URL" },
      { status: 400 }
    );
  }

  const client = new DynamoDBClient({
    region: awsConfig.region,
    ...(awsConfig.credentials.accessKeyId
      ? { credentials: awsConfig.credentials }
      : {}),
  });

  const scan = await client.send(
    new ScanCommand({
      TableName: awsConfig.dynamodb.usersTable,
      FilterExpression: "email = :e",
      ExpressionAttributeValues: { ":e": { S: email.toLowerCase() } },
    })
  );

  const items = (scan.Items || []).map((i) => unmarshall(i));
  if (items.length === 0) {
    return NextResponse.json({
      lookedUp: email,
      result: "NO PROFILE FOUND in math-tutoring-users for that email",
    });
  }

  const profile = items[0];
  const householdSub = await getHouseholdSub(profile.sub);
  const householdProfile =
    householdSub === profile.sub
      ? profile
      : await getUserProfile(householdSub);

  const pendingInvite = await getFamilyInvitationByInvitedEmail(email);

  return NextResponse.json({
    lookedUp: email,
    profile,
    isLinkedChild: !!profile.parentSub,
    parentSubField: profile.parentSub || "(missing)",
    resolvedHouseholdSub: householdSub,
    householdProfile,
    pendingFamilyInvite: pendingInvite,
  });
}
