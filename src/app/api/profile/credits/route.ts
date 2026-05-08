import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, getHouseholdSub } from "@/lib/auth-helpers";
import { getUserProfile, ensureUserProfile } from "@/lib/dynamodb";

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
    const householdSub = await getHouseholdSub(user.sub);
    let profile = await getUserProfile(householdSub);

    // Auto-create profile with 1 free credit only for unlinked new users.
    // Linked students share the parent's credit pool, so don't issue another.
    if (!profile && householdSub === user.sub) {
      profile = {
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        freeSessionCredits: 1,
        createdAt: new Date().toISOString(),
      };
      // Conditional put — if another request (like family-invite redeem)
      // created the profile concurrently, don't clobber it. Re-fetch instead.
      await ensureUserProfile(profile);
      profile = (await getUserProfile(user.sub)) || profile;
    }

    return NextResponse.json({
      credits: profile?.freeSessionCredits || 0,
    });
  } catch (error: any) {
    console.error("Get credits error:", error);
    return NextResponse.json(
      { error: "Failed to get credits" },
      { status: 500 }
    );
  }
}
