import { NextRequest, NextResponse } from "next/server";
import { requireTutor } from "@/lib/auth-helpers";
import { listFiles, getDownloadUrl, getStudentUploadPrefix, getStudentNotesPrefix } from "@/lib/s3";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { awsConfig } from "@/lib/aws-config";

const cognitoClient = new CognitoIdentityProviderClient({
  region: awsConfig.region,
});

export async function GET(request: NextRequest) {
  const auth = await requireTutor(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  try {
    // Get all students from Cognito
    const usersResponse = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        Limit: 60,
      })
    );

    const students = (usersResponse.Users || [])
      .map((u) => {
        const attrs = u.Attributes || [];
        const sub = attrs.find((a) => a.Name === "sub")?.Value || "";
        const email = attrs.find((a) => a.Name === "email")?.Value || "";
        const name = attrs.find((a) => a.Name === "name")?.Value || "";
        return { sub, email, name, username: u.Username || "" };
      })
      .filter((s) => s.sub !== user.sub);

    // For each student, list their uploads and completed notes
    const studentFiles = await Promise.all(
      students.map(async (student) => {
        const uploadsPrefix = getStudentUploadPrefix(student.sub);
        const notesPrefix = getStudentNotesPrefix(student.sub);

        const [uploads, notes] = await Promise.all([
          listFiles(uploadsPrefix),
          listFiles(notesPrefix),
        ]);

        const uploadsWithUrls = await Promise.all(
          uploads.map(async (file) => ({
            ...file,
            lastModified: file.lastModified.toISOString(),
            downloadUrl: await getDownloadUrl(file.key),
            type: "upload" as const,
          }))
        );

        const notesWithUrls = await Promise.all(
          notes.map(async (file) => ({
            ...file,
            lastModified: file.lastModified.toISOString(),
            downloadUrl: await getDownloadUrl(file.key),
            type: "completed-note" as const,
          }))
        );

        return {
          student,
          uploads: uploadsWithUrls,
          completedNotes: notesWithUrls,
        };
      })
    );

    // Only return students that have at least one file
    const studentsWithFiles = studentFiles.filter(
      (s) => s.uploads.length > 0 || s.completedNotes.length > 0
    );

    return NextResponse.json({ studentFiles: studentsWithFiles });
  } catch (error: any) {
    console.error("List all files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
