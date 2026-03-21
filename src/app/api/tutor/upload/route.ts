import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, isTutor } from "@/lib/auth-helpers";
import { uploadFile, getStudentNotesPrefix } from "@/lib/s3";
import { jwtDecode } from "jwt-decode";

interface IdTokenPayload {
  sub: string;
  email: string;
  "cognito:groups"?: string[];
}

export async function POST(request: NextRequest) {
  // The tutor sends their ID token (which contains groups)
  const idToken = request.headers.get("x-id-token");
  const accessToken = extractToken(request.headers.get("authorization"));

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the access token is valid
  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check tutor group from ID token
  if (idToken) {
    try {
      const decoded = jwtDecode<IdTokenPayload>(idToken);
      const groups = decoded["cognito:groups"] || [];
      if (!isTutor(groups)) {
        return NextResponse.json({ error: "Tutor access required" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
    }
  } else {
    // Fallback: check if user email matches tutor email
    const tutorEmail = process.env.TUTOR_EMAIL;
    if (user.email !== tutorEmail) {
      return NextResponse.json({ error: "Tutor access required" }, { status: 403 });
    }
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
