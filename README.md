# Math Tutoring App

A Next.js web application for math tutoring, integrated with AWS services.

## Architecture

- **Frontend**: Next.js 14 (App Router) with Tailwind CSS
- **Auth**: Amazon Cognito (user pools, groups for tutor/student roles)
- **Storage**: S3 (student uploads scoped by Cognito sub, tutor-uploaded notes)
- **Database**: DynamoDB (sessions, user profiles)
- **Notifications**: SES emails triggered by EventBridge + Lambda (6-hour reminders)
- **Hosting**: AWS Amplify

## S3 Folder Structure

```
math-tutoring-files/
├── students/
│   └── {cognito-sub}/
│       ├── uploads/          ← student's own uploaded files
│       └── completed-notes/  ← tutor-uploaded session notes
```

Each student can only access files under their own `{cognito-sub}` prefix.

## Getting Started

### 1. Deploy AWS Infrastructure

```bash
aws cloudformation deploy \
  --template-file infrastructure/cloudformation-template.yaml \
  --stack-name math-tutoring \
  --parameter-overrides TutorEmail=your-email@example.com \
  --capabilities CAPABILITY_IAM
```

### 2. Get the output values

```bash
aws cloudformation describe-stacks --stack-name math-tutoring --query 'Stacks[0].Outputs'
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
# Fill in the values from CloudFormation outputs
```

### 4. Add yourself as a tutor

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id YOUR_POOL_ID \
  --username YOUR_USERNAME \
  --group-name tutors
```

### 5. Verify SES email

```bash
aws ses verify-email-identity --email-address your-email@example.com
```

### 6. Deploy Lambda code

```bash
cd infrastructure/lambda/session-reminder
zip -r function.zip index.mjs
aws lambda update-function-code \
  --function-name math-tutoring-session-reminder \
  --zip-file fileb://function.zip
```

### 7. Run locally

```bash
npm install
npm run dev
```

### 8. Deploy to Amplify

Connect your Git repository to AWS Amplify. The `amplify.yml` build config is included. Set the environment variables from `.env.local.example` in the Amplify console.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/signin` | Sign in |
| `/auth/signup` | Create account |
| `/auth/confirm` | Verify email code |
| `/auth/forgot-password` | Reset password |
| `/dashboard` | Student dashboard |
| `/my-files` | Upload & manage files |
| `/completed-notes` | View tutor-uploaded notes |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/files/upload` | POST | Student file upload (scoped to their S3 prefix) |
| `/api/files/list` | GET | List student's uploaded files |
| `/api/files/delete` | DELETE | Delete student's own file |
| `/api/tutor/upload` | POST | Tutor uploads completed notes for a student |
| `/api/tutor/files` | GET | Student retrieves their completed notes |
| `/api/sessions` | GET/POST | List/create tutoring sessions |
