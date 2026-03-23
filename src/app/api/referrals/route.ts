import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  createReferral,
  getReferralsByReferrer,
  getReferralByInvitedEmail,
  Referral,
} from "@/lib/dynamodb";
import { sendReferralInviteEmail } from "@/lib/ses";
import { randomUUID } from "crypto";

const MAX_REFERRALS = 5;

// POST - Send a referral invite
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
    const invitedEmail = (body.invitedEmail || "").trim().toLowerCase();

    if (!invitedEmail || !invitedEmail.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Can't invite yourself
    if (invitedEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot refer yourself" },
        { status: 400 }
      );
    }

    // Check max referrals
    const existingReferrals = await getReferralsByReferrer(user.sub);
    if (existingReferrals.length >= MAX_REFERRALS) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${MAX_REFERRALS} referrals` },
        { status: 400 }
      );
    }

    // Check if already invited this email
    const alreadyInvited = existingReferrals.some(
      (r) => r.invitedEmail === invitedEmail
    );
    if (alreadyInvited) {
      return NextResponse.json(
        { error: "You have already invited this email" },
        { status: 400 }
      );
    }

    // Check if this email was already referred by someone else
    const existingReferral = await getReferralByInvitedEmail(invitedEmail);
    if (existingReferral) {
      return NextResponse.json(
        { error: "This email has already been referred" },
        { status: 400 }
      );
    }

    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const referral: Referral = {
      token,
      referrerSub: user.sub,
      referrerEmail: user.email,
      invitedEmail,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await createReferral(referral);

    // Build signup URL with referral token
    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const signupUrl = `${baseUrl}/auth/signup?referralToken=${token}`;

    // Send invite email
    const referrerName = user.email.split("@")[0];
    try {
      await sendReferralInviteEmail({
        to: invitedEmail,
        referrerName,
        signupUrl,
      });
    } catch (emailError) {
      console.error("Failed to send referral email:", emailError);
    }

    return NextResponse.json({ referral }, { status: 201 });
  } catch (error: any) {
    console.error("Create referral error:", error);
    return NextResponse.json(
      { error: "Failed to create referral" },
      { status: 500 }
    );
  }
}

// GET - List my referrals
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
    const referrals = await getReferralsByReferrer(user.sub);
    return NextResponse.json({ referrals, maxReferrals: MAX_REFERRALS });
  } catch (error: any) {
    console.error("Get referrals error:", error);
    return NextResponse.json(
      { error: "Failed to get referrals" },
      { status: 500 }
    );
  }
}
