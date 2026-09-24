import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { getSession, addSessionAttachment } from "@/lib/dynamodb";
import { uploadFile, getSessionAttachmentPrefix, getDownloadUrl } from "@/lib/s3";

// POST - Attach a file (the actual worked-through material from a session)
// to that session's record. Tutor-only; the student's sub is read from the
// session itself rather than trusted client input.
export async function POST(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: "file and sessionId are required" },
        { status: 400 }
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB, matching the existing tutor upload limit
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const prefix = getSessionAttachmentPrefix(session.studentSub, sessionId);
    const key = `${prefix}${Date.now()}-${file.name}`;

    await uploadFile(key, buffer, file.type);

    const attachment = {
      key,
      name: file.name,
      uploadedAt: new Date().toISOString(),
    };
    await addSessionAttachment(sessionId, attachment);

    const url = await getDownloadUrl(key);
    return NextResponse.json({ attachment: { ...attachment, url } });
  } catch (error: any) {
    console.error("Session attachment upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}
