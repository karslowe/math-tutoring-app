import { NextRequest, NextResponse } from "next/server";
import { getReferral } from "@/lib/dynamodb";

// GET - Validate a referral token (unauthenticated)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, reason: "Token is required" },
      { status: 400 }
    );
  }

  try {
    const referral = await getReferral(token);

    if (!referral) {
      return NextResponse.json({ valid: false, reason: "Invalid referral token" });
    }

    if (referral.status !== "pending") {
      return NextResponse.json({ valid: false, reason: "This referral has already been used" });
    }

    if (new Date(referral.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, reason: "This referral has expired" });
    }

    return NextResponse.json({
      valid: true,
      referrerEmail: referral.referrerEmail,
      invitedEmail: referral.invitedEmail,
    });
  } catch (error: any) {
    console.error("Validate referral error:", error);
    return NextResponse.json(
      { valid: false, reason: "Failed to validate referral" },
      { status: 500 }
    );
  }
}
