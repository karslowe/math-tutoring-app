import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import { listFiles, getDownloadUrl, getStudentUploadPrefix } from "@/lib/s3";

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
    const prefix = getStudentUploadPrefix(user.sub);
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
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
