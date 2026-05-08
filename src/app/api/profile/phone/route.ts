import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  getUserProfile,
  upsertUserProfile,
  updateUserPhone,
} from "@/lib/dynamodb";

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

// GET - current phone number
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
    return NextResponse.json({ phone: profile?.phone || "" });
  } catch (error: any) {
    console.error("Get phone error:", error);
    return NextResponse.json({ error: "Failed to get phone" }, { status: 500 });
  }
}

// PUT - update phone number (empty string clears)
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
    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const phone = phoneRaw.trim() ? normalizePhone(phoneRaw) : "";

    if (phone && !/^\+\d{8,15}$/.test(phone)) {
      return NextResponse.json(
        { error: "Phone must be in international format (e.g. +14155550123)" },
        { status: 400 }
      );
    }

    const existing = await getUserProfile(user.sub);
    if (!existing) {
      await upsertUserProfile({
        sub: user.sub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        phone: phone || undefined,
        freeSessionCredits: 1,
        createdAt: new Date().toISOString(),
      });
    } else {
      await updateUserPhone(user.sub, phone);
    }

    return NextResponse.json({ phone });
  } catch (error: any) {
    console.error("Update phone error:", error);
    return NextResponse.json(
      { error: "Failed to update phone" },
      { status: 500 }
    );
  }
}
