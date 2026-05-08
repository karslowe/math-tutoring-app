import { NextRequest, NextResponse } from "next/server";
import {
  getFamilyInvitationByInvitedEmail,
  getUserProfile,
  ensureUserProfile,
  updateParentLink,
} from "@/lib/dynamodb";

// TEMP local-dev endpoint — reconciles a stranded student account by reading
// the most-recent family invitation for the given email and applying the
// parent link directly (no Cognito auth required). Use this to recover from
// the "redeem ran but parentSub never persisted" bug. Remove before deploying.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Disabled in production" },
      { status: 403 }
    );
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "Pass ?email=<student address>" },
      { status: 400 }
    );
  }

  const trace: Array<{ step: string; ok: boolean; detail?: any }> = [];
  try {
    trace.push({ step: "lookup_invite_start", ok: true });
    const invite = await getFamilyInvitationByInvitedEmail(email);
    trace.push({ step: "lookup_invite_done", ok: true, detail: !!invite });

    if (!invite) {
      return NextResponse.json({
        result: "no_invitation_found",
        email,
        trace,
      });
    }

    if (!invite.redeemedBySub) {
      return NextResponse.json({
        result: "invitation_has_no_redeemer",
        invite,
        trace,
      });
    }

    const studentSub = invite.redeemedBySub;

    trace.push({ step: "fetch_profile_before", ok: true });
    const profileBefore = await getUserProfile(studentSub);
    trace.push({
      step: "fetch_profile_before_done",
      ok: true,
      detail: !!profileBefore,
    });

    trace.push({ step: "ensure_profile", ok: true });
    await ensureUserProfile({
      sub: studentSub,
      email,
      displayName: email.split("@")[0],
      role: "student",
      parentSub: invite.parentSub,
      parentEmail: invite.parentEmail,
      parentName: invite.parentName,
      freeSessionCredits: 0,
      createdAt: profileBefore?.createdAt || new Date().toISOString(),
    });
    trace.push({ step: "ensure_profile_done", ok: true });

    trace.push({ step: "update_parent_link", ok: true });
    await updateParentLink(
      studentSub,
      invite.parentSub,
      invite.parentEmail,
      invite.parentName
    );
    trace.push({ step: "update_parent_link_done", ok: true });

    const profileAfter = await getUserProfile(studentSub);

    return NextResponse.json({
      result: "reconciled",
      studentSub,
      parentSub: invite.parentSub,
      profileBefore,
      profileAfter,
      trace,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        result: "error",
        errorName: err?.name,
        errorMessage: err?.message,
        errorType: err?.__type,
        stack: err?.stack?.split("\n").slice(0, 8),
        trace,
      },
      { status: 500 }
    );
  }
}
