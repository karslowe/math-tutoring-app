import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, getHouseholdSub } from "@/lib/auth-helpers";
import { getSessionsByStudent } from "@/lib/dynamodb";
import { getDownloadUrl } from "@/lib/s3";

// GET - Student views their own session history
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
    const householdSub = await getHouseholdSub(user.sub);
    const sessions = await getSessionsByStudent(householdSub);
    const enriched = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        attachments: s.attachments
          ? await Promise.all(
              s.attachments.map(async (a) => ({
                ...a,
                url: await getDownloadUrl(a.key),
              }))
            )
          : undefined,
      }))
    );
    return NextResponse.json({ sessions: enriched });
  } catch (error: any) {
    console.error("Get session history error:", error);
    return NextResponse.json(
      { error: "Failed to get session history" },
      { status: 500 }
    );
  }
}
