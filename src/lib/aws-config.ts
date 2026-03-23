export const awsConfig = {
  region: process.env.AWS_REGION || process.env.APP_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.APP_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.APP_SECRET_ACCESS_KEY || "",
  },
  cognito: {
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
  },
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || process.env.APP_S3_BUCKET_NAME || "math-tutoring-files",
  },
  dynamodb: {
    sessionsTable: process.env.DYNAMODB_TABLE_SESSIONS || "math-tutoring-sessions",
    usersTable: process.env.DYNAMODB_TABLE_USERS || "math-tutoring-users",
    availabilityTable: process.env.DYNAMODB_TABLE_AVAILABILITY || "math-tutoring-availability",
    referralsTable: process.env.DYNAMODB_TABLE_REFERRALS || "math-tutoring-referrals",
  },
  ses: {
    fromEmail: process.env.SES_FROM_EMAIL || "",
  },
  tutorEmail: process.env.TUTOR_EMAIL || "",
};
