import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { getSession } from "@/lib/dynamodb";
import { getSessionAttachmentPrefix, getUploadUrl } from "@/lib/s3";

const MAX_SIZE = 50 * 1024 * 1024; // matches the existing tutor upload limit

// POST - Step 1 of a direct-to-S3 session attachment upload. Returns a
// short-lived presigned PUT URL; the client uploads the bytes to S3 itself,
// then calls the attachments route to record the file on the session.
export async function POST(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { sessionId, fileName, contentType, size } = await request.json();

    if (
      typeof sessionId !== "string" ||
      typeof fileName !== "string" ||
      (contentType !== undefined && typeof contentType !== "string") ||
      !fileName ||
      typeof size !== "number" ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return NextResponse.json(
        { error: "sessionId, fileName and size are required" },
        { status: 400 }
      );
    }
    if (size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Slashes would escape the session folder; the confirm step also checks this.
    const safeName = fileName.replace(/[\\/]/g, "_");
    const key = `${getSessionAttachmentPrefix(session.studentSub, sessionId)}${Date.now()}-${safeName}`;
    const type = contentType || "application/octet-stream";

    const uploadUrl = await getUploadUrl(key, type, size);
    return NextResponse.json({ uploadUrl, key, name: fileName });
  } catch (error: any) {
    console.error("Session attachment presign error:", error);
    return NextResponse.json(
      { error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}
