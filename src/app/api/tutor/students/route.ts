import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "@/lib/aws-config";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});

export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  try {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        Limit: 60,
      })
    );

    const students = (response.Users || [])
      .map((u) => {
        const attrs = u.Attributes || [];
        const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
        const email = attrs.find((a) => a.Name === "email")?.Value || "";
        const name = attrs.find((a) => a.Name === "name")?.Value || "";
        return { sub, email, name, username: u.Username || "" };
      })
      .filter((s) => s.sub !== user.sub); // Exclude the tutor themselves

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error("List students error:", error);
    return NextResponse.json(
      { error: "Failed to list students", detail: error.message || String(error) },
      { status: 500 }
    );
  }
}
