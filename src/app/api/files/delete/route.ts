import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import { deleteFile, getStudentUploadPrefix } from "@/lib/s3";

export async function DELETE(request: NextRequest) {
  const token = extractToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "No file key provided" }, { status: 400 });
    }

    // Ensure the user can only delete their own files
    const prefix = getStudentUploadPrefix(user.sub);
    if (!key.startsWith(prefix)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await deleteFile(key);

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
