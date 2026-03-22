export const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  cognito: {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
  },
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || "math-tutoring-files",
  },
  dynamodb: {
    sessionsTable: process.env.DYNAMODB_TABLE_SESSIONS || "math-tutoring-sessions",
    usersTable: process.env.DYNAMODB_TABLE_USERS || "math-tutoring-users",
    availabilityTable: process.env.DYNAMODB_TABLE_AVAILABILITY || "math-tutoring-availability",
  },
  ses: {
    fromEmail: process.env.SES_FROM_EMAIL || "",
  },
  tutorEmail: process.env.TUTOR_EMAIL || "",
};
