import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { getTopicProgressByStudent } from "@/lib/dynamodb";
import { jwtDecode } from "jwt-decode";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

// GET - Tutor views a student's topic progress
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
      hasTutorAccess = isTutor(decoded["cognito:groups"] || []);
    } catch {
      hasTutorAccess = false;
    }
  }
  if (!hasTutorAccess) {
    hasTutorAccess = user.email === process.env.TUTOR_EMAIL;
  }

  if (!hasTutorAccess) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 }
    );
  }

  const studentSub = request.nextUrl.searchParams.get("studentSub");
  if (!studentSub) {
    return NextResponse.json(
      { error: "studentSub query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const progress = await getTopicProgressByStudent(studentSub);
    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error("Get tutor progress error:", error);
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 }
    );
  }
}
