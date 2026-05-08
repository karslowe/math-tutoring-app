import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken, getHouseholdSub } from "@/lib/auth-helpers";
import {
  getUserProfile,
  ensureUserProfile,
  updateSurvey,
} from "@/lib/dynamodb";
import { sendSurveyCompletedEmail } from "@/lib/ses";

const VALID_SUBJECTS = [
  "SAT/ACT",
  "6th",
  "7th",
  "8th",
  "Algebra 1",
  "Algebra 2",
  "Geometry",
  "Pre-Calculus",
  "Calculus AB",
  "Calculus BC",
];

const VALID_GOALS = [
  "Need help",
  "For fun",
  "To get ahead",
  "To do well on SAT or ACT",
];

// GET - Return current survey status for this user
export async function GET(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const householdSub = await getHouseholdSub(user.sub);
    const profile = await getUserProfile(householdSub);
    return NextResponse.json({
      surveyCompleted: profile?.surveyCompleted === true,
      surveySubject: profile?.surveySubject || null,
      surveyGoal: profile?.surveyGoal || null,
    });
  } catch (error: any) {
    console.error("Get survey status error:", error);
    return NextResponse.json(
      { error: "Failed to get survey status" },
      { status: 500 }
    );
  }
}

// POST - Save survey answers and notify tutor
export async function POST(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subject, goal } = body;

    if (!VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { error: "Invalid subject" },
        { status: 400 }
      );
    }
    if (!VALID_GOALS.includes(goal)) {
      return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
    }

    const householdSub = await getHouseholdSub(user.sub);
    let profile = await getUserProfile(householdSub);
    if (!profile) {
      profile = {
        sub: householdSub,
        email: user.email,
        displayName: user.email.split("@")[0],
        role: "student",
        freeSessionCredits: householdSub === user.sub ? 1 : 0,
        surveySubject: subject,
        surveyGoal: goal,
        surveyCompleted: true,
        createdAt: new Date().toISOString(),
      };
      // Conditional put so we don't overwrite a profile created by a
      // concurrent request. If one already exists, fall through to update.
      await ensureUserProfile(profile);
      const existing = await getUserProfile(householdSub);
      if (existing) {
        profile = existing;
        await updateSurvey(householdSub, subject, goal);
      }
    } else {
      await updateSurvey(householdSub, subject, goal);
    }

    try {
      await sendSurveyCompletedEmail({
        studentName: profile.displayName || user.email,
        studentEmail: user.email,
        subject,
        goal,
      });
    } catch (emailError) {
      console.error("Survey notification email failed:", emailError);
    }

    return NextResponse.json({ message: "Survey saved", subject, goal });
  } catch (error: any) {
    console.error("Save survey error:", error);
    return NextResponse.json(
      { error: "Failed to save survey" },
      { status: 500 }
    );
  }
}
