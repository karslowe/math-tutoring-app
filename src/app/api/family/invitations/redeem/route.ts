import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  getFamilyInvitation,
  getFamilyInvitationByInvitedEmail,
  markFamilyInvitationAccepted,
  getUserProfile,
  ensureUserProfile,
  updateParentLink,
  FamilyInvitation,
} from "@/lib/dynamodb";

// POST - Redeem a family invitation. If a token is supplied in the body it's
// used directly; otherwise we look up the most recent pending invite for the
// caller's email. The email-fallback path makes linking robust to anything
// that disrupts the sessionStorage handoff between signup → confirm → signin.
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
    let body: { token?: string } = {};
    try {
      body = await request.json();
    } catch {
      // empty body is allowed — auto-redeem by email
    }

    let invite: FamilyInvitation | null = null;
    if (body.token) {
      invite = await getFamilyInvitation(body.token);
    } else {
      invite = await getFamilyInvitationByInvitedEmail(user.email);
    }

    if (!invite) {
      // Treat as no-op so the dashboard can call this freely.
      return NextResponse.json({ success: false, reason: "no_invitation" });
    }

    // Allow self-heal: if the invite was already redeemed by THIS user but
    // the parent link never made it onto their profile (e.g. lost to a
    // PutCommand race during initial signup), reapply it.
    const isSelfHeal =
      invite.status === "accepted" && invite.redeemedBySub === user.sub;

    if (invite.status !== "pending" && !isSelfHeal) {
      return NextResponse.json({ success: false, reason: "already_used" });
    }

    if (invite.status === "pending" && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, reason: "expired" });
    }

    if (invite.invitedStudentEmail !== user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, reason: "email_mismatch" },
        { status: 403 }
      );
    }

    if (invite.parentSub === user.sub) {
      return NextResponse.json(
        { success: false, reason: "self_link" },
        { status: 400 }
      );
    }

    // Ensure student profile exists, then attach the parent link.
    // Linked students share the parent's credits, so don't issue a new credit.
    // Two-phase: (1) conditional put creates only if absent, (2) update sets
    // the parent link unconditionally — so even if a concurrent request
    // created the profile first (e.g. credits route at first login), the
    // parent link still ends up persisted.
    await ensureUserProfile({
      sub: user.sub,
      email: user.email,
      displayName: user.email.split("@")[0],
      role: "student",
      parentSub: invite.parentSub,
      parentEmail: invite.parentEmail,
      parentName: invite.parentName,
      freeSessionCredits: 0,
      createdAt: new Date().toISOString(),
    });
    await updateParentLink(
      user.sub,
      invite.parentSub,
      invite.parentEmail,
      invite.parentName
    );

    // markFamilyInvitationAccepted has a status=pending condition, so only
    // call it on the first redemption — not on self-heal.
    if (!isSelfHeal) {
      await markFamilyInvitationAccepted(invite.token, user.sub);
    }

    return NextResponse.json({
      success: true,
      parentEmail: invite.parentEmail,
      parentName: invite.parentName,
      selfHealed: isSelfHeal,
    });
  } catch (error: any) {
    console.error("Redeem family invitation error:", error);
    return NextResponse.json(
      { error: "Failed to redeem invitation" },
      { status: 500 }
    );
  }
}
