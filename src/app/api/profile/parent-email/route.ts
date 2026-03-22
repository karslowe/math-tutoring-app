import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  getUserProfile,
  upsertUserProfile,
  updateParentEmail,
} from "@/lib/dynamodb";

// GET - Get current parent email
export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const profile = await getUserProfile(user.sub);
    return NextResponse.json({
      parentEmail: profile?.parentEmail || "",
    });
  } catch (error: any) {
    console.error("Get parent email error:", error);
    return NextResponse.json(
      { error: "Failed to get parent email" },
      { status: 500 }
    );
  }
}

// PUT - Update parent email
export async function PUT(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { parentEmail } = body;

    if (typeof parentEmail !== "string") {
      return NextResponse.json(
        { error: "parentEmail is required" },
        { status: 400 }
      );
    }

    // Ensure the user profile exists first
    const existing = await getUserProfile(user.sub);
    if (!existing) {
      await upsertUserProfile({
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        parentEmail: parentEmail.trim(),
        createdAt: new Date().toISOString(),
      });
    } else {
      await updateParentEmail(user.sub, parentEmail.trim());
    }

    return NextResponse.json({
      message: "Parent email updated successfully",
      parentEmail: parentEmail.trim(),
    });
  } catch (error: any) {
    console.error("Update parent email error:", error);
    return NextResponse.json(
      { error: "Failed to update parent email" },
      { status: 500 }
    );
  }
}
