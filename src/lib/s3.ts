import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsConfig } from "./aws-config";

const s3Client = new S3Client({
  region: awsConfig.region,
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
