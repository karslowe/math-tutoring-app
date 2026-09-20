import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { uploadFile, getStudentNotesPrefix } from "@/lib/s3";

export async function POST(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const studentSub = formData.get("studentSub") as string;

    if (!file || !studentSub) {
      return NextResponse.json(
        { error: "File and studentSub are required" },
        { status: 400 }
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB for tutor
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const prefix = getStudentNotesPrefix(studentSub);
    const key = `${prefix}${file.name}`;

    await uploadFile(key, buffer, file.type);

    return NextResponse.json({
      message: "Notes uploaded successfully",
      key,
      name: file.name,
    });
  } catch (error: any) {
    console.error("Tutor upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload notes" },
      { status: 500 }
    );
  }
}
