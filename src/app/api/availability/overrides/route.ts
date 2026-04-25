import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import {
  getDateOverrides,
  setDateOverride,
  deleteDateOverride,
} from "@/lib/dynamodb";
import { jwtDecode } from "jwt-decode";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

function verifyTutorAccess(
  idToken: string | null,
  userEmail: string
): boolean {
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      return isTutor(groups);
    } catch {
      return false;
    }
  }
  return userEmail === process.env.TUTOR_EMAIL;
}

// GET - Any authenticated user can view date overrides
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  try {
    const overrides = await getDateOverrides(startDate, endDate);
    return NextResponse.json({ overrides });
  } catch (error: any) {
    console.error("Get overrides error:", error);
    return NextResponse.json(
      { error: "Failed to get overrides" },
      { status: 500 }
    );
  }
}

// POST - Tutor creates a date override
export async function POST(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!verifyTutorAccess(idToken, user.email)) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { date, blockedRanges } = body;

    if (!date || !Array.isArray(blockedRanges)) {
      return NextResponse.json(
        { error: "date and blockedRanges are required" },
        { status: 400 }
      );
    }

    await setDateOverride(date, blockedRanges);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set override error:", error);
    return NextResponse.json(
      { error: "Failed to set override" },
      { status: 500 }
    );
  }
}

// DELETE - Tutor removes a date override
export async function DELETE(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!verifyTutorAccess(idToken, user.email)) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { error: "date query parameter is required" },
      { status: 400 }
    );
  }

  try {
    await deleteDateOverride(date);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete override error:", error);
    return NextResponse.json(
      { error: "Failed to delete override" },
      { status: 500 }
    );
  }
}
