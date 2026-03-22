import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { getScheduledSessionsByDateRange } from "@/lib/dynamodb";
import { jwtDecode } from "jwt-decode";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

// GET - Tutor views all booked sessions in a date range
export async function GET(request: NextRequest) {
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
  let hasTutorAccess = false;
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      hasTutorAccess = isTutor(groups);
    } catch {
      hasTutorAccess = false;
    }
  } else {
    hasTutorAccess = user.email === process.env.TUTOR_EMAIL;
  }

  if (!hasTutorAccess) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
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
    const sessions = await getScheduledSessionsByDateRange(
      new Date(startDate).toISOString(),
      new Date(endDate + "T23:59:59").toISOString()
    );
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Get tutor bookings error:", error);
    return NextResponse.json(
      { error: "Failed to get bookings" },
      { status: 500 }
    );
  }
}
