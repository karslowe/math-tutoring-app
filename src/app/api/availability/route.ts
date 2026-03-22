import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { getWeeklyAvailability, setWeeklyAvailability } from "@/lib/dynamodb";
import { jwtDecode } from "jwt-decode";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

// GET - Any authenticated user can view weekly availability
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
    const availability = await getWeeklyAvailability();
    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error("Get availability error:", error);
    return NextResponse.json(
      { error: "Failed to get availability" },
      { status: 500 }
    );
  }
}

// PUT - Tutor sets weekly availability for a day
export async function PUT(request: NextRequest) {
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Verify tutor access
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      if (!isTutor(groups)) {
        return NextResponse.json(
          { error: "Tutor access required" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Tutor access required" },
        { status: 403 }
      );
    }
  } else if (user.email !== process.env.TUTOR_EMAIL) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { dayOfWeek, slots } = body;

    if (!dayOfWeek || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "dayOfWeek and slots are required" },
        { status: 400 }
      );
    }

    const validDays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    if (!validDays.includes(dayOfWeek.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid day of week" },
        { status: 400 }
      );
    }

    await setWeeklyAvailability(dayOfWeek.toLowerCase(), slots);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set availability error:", error);
    return NextResponse.json(
      { error: "Failed to set availability" },
      { status: 500 }
    );
  }
}
