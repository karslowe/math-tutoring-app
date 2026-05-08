import { NextRequest, NextResponse } from "next/server";
import { getFamilyInvitation } from "@/lib/dynamodb";

// GET - Validate a family-invite token (unauthenticated)
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, reason: "Token is required" },
      { status: 400 }
    );
  }

  try {
    const invite = await getFamilyInvitation(token);

    if (!invite) {
      return NextResponse.json({
        valid: false,
        reason: "Invalid invitation token",
      });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({
        valid: false,
        reason: "This invitation has already been accepted",
      });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({
        valid: false,
        reason: "This invitation has expired",
      });
    }

    return NextResponse.json({
      valid: true,
      parentEmail: invite.parentEmail,
      parentName: invite.parentName,
      invitedStudentEmail: invite.invitedStudentEmail,
    });
  } catch (error: any) {
    console.error("Validate family invitation error:", error);
    return NextResponse.json(
      { valid: false, reason: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
