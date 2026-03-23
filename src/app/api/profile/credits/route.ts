import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import { getUserProfile, upsertUserProfile } from "@/lib/dynamodb";

// GET - Get current free session credits (creates profile with 1 free credit if new)
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    let profile = await getUserProfile(user.sub);

    // Auto-create profile with 1 free credit for new students
    if (!profile) {
      profile = {
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        freeSessionCredits: 1,
        createdAt: new Date().toISOString(),
      };
      await upsertUserProfile(profile);
    }

    return NextResponse.json({
      credits: profile.freeSessionCredits || 0,
    });
  } catch (error: any) {
    console.error("Get credits error:", error);
    return NextResponse.json(
      { error: "Failed to get credits" },
      { status: 500 }
    );
  }
}
