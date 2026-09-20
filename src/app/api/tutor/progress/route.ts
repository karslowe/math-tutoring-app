import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { getTopicProgressByStudent } from "@/lib/dynamodb";

// GET - Tutor views a student's topic progress
export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
