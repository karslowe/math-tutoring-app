import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, getHouseholdSub } from "@/lib/auth-helpers";
import { listFiles, getDownloadUrl, getStudentNotesPrefix } from "@/lib/s3";

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
    // Students see notes scoped to their household (parent's sub if linked)
    const householdSub = await getHouseholdSub(user.sub);
    const prefix = getStudentNotesPrefix(householdSub);
    const files = await listFiles(prefix);

    const filesWithUrls = await Promise.all(
      files.map(async (file) => ({
        ...file,
        lastModified: file.lastModified.toISOString(),
        downloadUrl: await getDownloadUrl(file.key),
      }))
    );

    return NextResponse.json({ files: filesWithUrls });
  } catch (error: any) {
    console.error("List tutor files error:", error);
    return NextResponse.json(
      { error: "Failed to list notes" },
      { status: 500 }
    );
  }
}
