import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { jwtDecode } from "jwt-decode";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "@/lib/aws-config";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});

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

  // Check tutor role
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      if (!isTutor(groups)) {
        return NextResponse.json({ error: "Tutor access required" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
    }
  } else {
    const tutorEmail = process.env.TUTOR_EMAIL;
    if (user.email !== tutorEmail) {
      return NextResponse.json({ error: "Tutor access required" }, { status: 403 });
    }
  }

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
