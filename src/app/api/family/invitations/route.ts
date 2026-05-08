import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  createFamilyInvitation,
  getFamilyInvitationsByParent,
  getFamilyInvitationByInvitedEmail,
  getUserProfile,
  upsertUserProfile,
  FamilyInvitation,
} from "@/lib/dynamodb";
import { sendFamilyInviteEmail } from "@/lib/ses";
import { randomUUID } from "crypto";

const INVITE_TTL_DAYS = 14;

// POST - Send a family invite to a student email
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
    const invitedStudentEmail = (body.invitedStudentEmail || "")
      .trim()
      .toLowerCase();

    if (!invitedStudentEmail || !invitedStudentEmail.includes("@")) {
      return NextResponse.json(
        { error: "Valid student email is required" },
        { status: 400 }
      );
    }

    if (invitedStudentEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot invite your own email" },
        { status: 400 }
      );
    }

    const existingInvite = await getFamilyInvitationByInvitedEmail(
      invitedStudentEmail
    );
    if (existingInvite && existingInvite.status === "pending") {
      return NextResponse.json(
        { error: "This email already has a pending invite" },
        { status: 400 }
      );
    }

    // Ensure the parent's profile exists so we know their displayName
    let parentProfile = await getUserProfile(user.sub);
    if (!parentProfile) {
      parentProfile = {
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        createdAt: new Date().toISOString(),
      };
      await upsertUserProfile(parentProfile);
    }

    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const invitation: FamilyInvitation = {
      token,
      parentSub: user.sub,
      parentEmail: user.email,
      parentName: parentProfile.displayName,
      invitedStudentEmail,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await createFamilyInvitation(invitation);

    const baseUrl = request.headers.get("origin") || "http://localhost:3000";
    const signupUrl = `${baseUrl}/auth/signup?familyToken=${token}`;

    try {
      await sendFamilyInviteEmail({
        to: invitedStudentEmail,
        parentName: parentProfile.displayName,
        parentEmail: user.email,
        signupUrl,
      });
    } catch (emailError) {
      console.error("Failed to send family invite email:", emailError);
    }

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error: any) {
    console.error("Create family invitation error:", error);
    return NextResponse.json(
      { error: "Failed to create family invitation" },
      { status: 500 }
    );
  }
}

// GET - List invitations sent by the current user
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
    const invitations = await getFamilyInvitationsByParent(user.sub);
    return NextResponse.json({ invitations });
  } catch (error: any) {
    console.error("Get family invitations error:", error);
    return NextResponse.json(
      { error: "Failed to get family invitations" },
      { status: 500 }
    );
  }
}
