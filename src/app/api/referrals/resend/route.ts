import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import { getReferral } from "@/lib/dynamodb";
import { sendReferralInviteEmail } from "@/lib/ses";

// POST - Resend a referral invite email
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
        { error: "Referral not found" },
        { status: 404 }
      );
    }

    // Only the referrer can resend
    if (referral.referrerSub !== user.sub) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    // Can only resend pending referrals
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

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const signupUrl = `${baseUrl}/auth/signup?referralToken=${referral.token}`;
    const referrerName = user.email.split("@")[0];

    await sendReferralInviteEmail({
      to: referral.invitedEmail,
      referrerName,
      signupUrl,
    });

    return NextResponse.json({ success: true, message: "Invite resent!" });
  } catch (error: any) {
    console.error("Resend referral error:", error);
    return NextResponse.json(
      { error: "Failed to resend invite" },
      { status: 500 }
    );
  }
}
