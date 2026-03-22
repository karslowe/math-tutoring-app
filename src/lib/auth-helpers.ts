import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "./aws-config";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
});

export interface TokenUser {
  sub: string;
  email: string;
  username: string;
  groups: string[];
}

/**
 * Verify a Cognito access token on the server side by calling GetUser.
 * Returns the user info if valid, null if not.
 */
export async function verifyToken(
  accessToken: string
): Promise<TokenUser | null> {
  try {
    const response = await cognitoClient.send(
      new GetUserCommand({ AccessToken: accessToken })
    );

    const attrs = response.UserAttributes || [];
    const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
    const email = attrs.find((a) => a.Name === "email")?.Value || "";

    return {
      sub,
      email,
      username: response.Username || "",
      groups: [], // Groups come from the ID token, not GetUser
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header.
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return authHeader;
}

/**
 * Check if the user is a tutor (in the "tutors" group).
 * For server-side checks, we decode the ID token's groups claim.
 */
export function isTutor(groups: string[]): boolean {
  return groups.includes("tutors");
}
