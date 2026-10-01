import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsConfig } from "./aws-config";

const s3Client = new S3Client({
  region: awsConfig.region,
  ...(awsConfig.credentials.accessKeyId ? { credentials: awsConfig.credentials } : {}),
});

const BUCKET = awsConfig.s3.bucketName;

/**
 * Get the S3 prefix for a student's uploads folder.
 * Structure: students/{cognitoSub}/uploads/
 */
export function getStudentUploadPrefix(sub: string): string {
  return `students/${sub}/uploads/`;
}

/**
 * Get the S3 prefix for a student's completed notes folder (tutor-uploaded).
 * Structure: students/{cognitoSub}/completed-notes/
 */
export function getStudentNotesPrefix(sub: string): string {
  return `students/${sub}/completed-notes/`;
}

/**
 * Get the S3 prefix for material attached to one specific session, as
 * opposed to the student's general completed-notes folder above.
 * Structure: students/{cognitoSub}/sessions/{sessionId}/
 */
export function getSessionAttachmentPrefix(
  studentSub: string,
  sessionId: string
): string {
  return `students/${studentSub}/sessions/${sessionId}/`;
}

/**
 * True when `key` is a direct child of the session's attachment folder.
 * Guards the confirm step so a client can't attach some other object.
 */
export function isSessionAttachmentKey(
  key: string,
  studentSub: string,
  sessionId: string
): boolean {
  const prefix = getSessionAttachmentPrefix(studentSub, sessionId);
  const rest = key.slice(prefix.length);
  return key.startsWith(prefix) && rest.length > 0 && !rest.includes("/");
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function listFiles(
  prefix: string
): Promise<{ key: string; name: string; size: number; lastModified: Date }[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    })
  );

  if (!response.Contents) return [];

  return response.Contents.filter((obj) => obj.Key && obj.Key !== prefix).map(
    (obj) => ({
      key: obj.Key!,
      name: obj.Key!.split("/").pop() || obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    })
  );
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

/**
 * Presigned PUT so the browser uploads straight to S3, bypassing the
 * host's request-body cap. ContentLength is signed, so S3 rejects an
 * upload whose size differs from what the server validated.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 600 });
}

/** Size in bytes of an object, or null if it doesn't exist. */
export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const res = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return res.ContentLength ?? 0;
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}
