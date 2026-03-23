import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  getReferral,
  updateReferralRedeemed,
  incrementFreeSessionCredits,
  getUserProfile,
  upsertUserProfile,
} from "@/lib/dynamodb";

// POST - Redeem a referral token after signup
export async function POST(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Referral token is required" },
        { status: 400 }
      );
    }

    const referral = await getReferral(token);

    if (!referral) {
      return NextResponse.json(
        { error: "Invalid referral token" },
        { status: 400 }
      );
    }

    if (referral.status !== "pending") {
      return NextResponse.json(
        { error: "This referral has already been used" },
        { status: 400 }
      );
    }

    if (new Date(referral.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "This referral has expired" },
        { status: 400 }
      );
    }

    // Verify the email matches
    if (referral.invitedEmail !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This referral was sent to a different email address" },
        { status: 403 }
      );
    }

    // Can't redeem your own referral
    if (referral.referrerSub === user.sub) {
      return NextResponse.json(
        { error: "You cannot redeem your own referral" },
        { status: 400 }
      );
    }

    // Mark referral as redeemed
    await updateReferralRedeemed(token, user.sub);

    // Ensure user profile exists and give them a free credit
    let profile = await getUserProfile(user.sub);
    if (!profile) {
      profile = {
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        freeSessionCredits: 1,
        referredBy: referral.referrerSub,
        createdAt: new Date().toISOString(),
      };
      await upsertUserProfile(profile);
    }

    // Give the new student 1 free session credit
    await incrementFreeSessionCredits(user.sub, 1);

    return NextResponse.json({
      success: true,
      message: "Referral redeemed! You have a free session credit.",
    });
  } catch (error: any) {
    console.error("Redeem referral error:", error);
    return NextResponse.json(
      { error: "Failed to redeem referral" },
      { status: 500 }
    );
  }
}
