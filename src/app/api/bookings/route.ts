import { NextRequest, NextResponse } from "next/server";
import { extractToken, verifyToken } from "@/lib/auth-helpers";
import {
  bookSession,
  cancelBooking,
  getSession,
  getSessionsByStudent,
  getUserProfile,
  decrementFreeSessionCredit,
  TutoringSession,
} from "@/lib/dynamodb";
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
} from "@/lib/ses";
import { randomUUID } from "crypto";

// POST - Student books a session
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
    const { scheduledAt, subject, useFreeCredit } = body;

    if (!scheduledAt) {
      return NextResponse.json(
        { error: "scheduledAt is required" },
        { status: 400 }
      );
    }

    // Ensure the slot is in the future
    if (new Date(scheduledAt) <= new Date()) {
      return NextResponse.json(
        { error: "Cannot book a slot in the past" },
        { status: 400 }
      );
    }

    const session: TutoringSession = {
      id: randomUUID(),
      studentSub: user.sub,
      studentEmail: user.email,
      scheduledAt,
      duration: 60,
      subject: subject || "KL Math Prep",
      notes: "",
      paidWithCredit: !!useFreeCredit,
      status: "scheduled",
      reminderSent: false,
      createdAt: new Date().toISOString(),
    };

    await bookSession(session);

    // Decrement free session credit if used
    if (useFreeCredit) {
      try {
        await decrementFreeSessionCredit(user.sub);
      } catch (creditError) {
        console.error("Failed to decrement credit:", creditError);
        // Don't fail the booking if credit decrement fails
      }
    }

    // Send confirmation email (non-blocking)
    try {
      const recipients = [user.email];
      const profile = await getUserProfile(user.sub);
      if (profile?.parentEmail) {
        recipients.push(profile.parentEmail);
      }
      // Notify tutor
      const tutorEmail = process.env.TUTOR_EMAIL;
      if (tutorEmail) {
        recipients.push(tutorEmail);
      }

      await sendBookingConfirmationEmail({
        to: recipients,
        studentName: user.email.split("@")[0],
        scheduledAt,
        subject: session.subject,
      });
    } catch (emailError) {
      console.error("Failed to send booking confirmation email:", emailError);
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error: any) {
    // TransactWriteCommand fails with TransactionCanceledException if slot is taken
    if (
      error.name === "TransactionCanceledException" ||
      error.__type?.includes("TransactionCanceledException")
    ) {
      return NextResponse.json(
        { error: "This time slot is no longer available" },
        { status: 409 }
      );
    }
    console.error("Book session error:", error);
    return NextResponse.json(
      { error: "Failed to book session" },
      { status: 500 }
    );
  }
}

// DELETE - Student cancels their booking
export async function DELETE(request: NextRequest) {
  const accessToken = extractToken(request.headers.get("authorization"));
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.studentSub !== user.sub) {
      return NextResponse.json(
        { error: "You can only cancel your own bookings" },
        { status: 403 }
      );
    }

    if (session.status !== "scheduled") {
      return NextResponse.json(
        { error: "Can only cancel scheduled sessions" },
        { status: 400 }
      );
    }

    await cancelBooking(sessionId, session.scheduledAt);

    // Send cancellation email (non-blocking)
    try {
      const recipients = [user.email];
      const profile = await getUserProfile(user.sub);
      if (profile?.parentEmail) {
        recipients.push(profile.parentEmail);
      }
      // Notify tutor
      const tutorEmail = process.env.TUTOR_EMAIL;
      if (tutorEmail) {
        recipients.push(tutorEmail);
      }

      await sendBookingCancellationEmail({
        to: recipients,
        studentName: user.email.split("@")[0],
        scheduledAt: session.scheduledAt,
        subject: session.subject,
      });
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}

// GET - Student's upcoming bookings
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
    const sessions = await getSessionsByStudent(user.sub);
    const upcoming = sessions.filter(
      (s) =>
        s.status === "scheduled" && new Date(s.scheduledAt) > new Date()
    );
    return NextResponse.json({ bookings: upcoming });
  } catch (error: any) {
    console.error("Get bookings error:", error);
    return NextResponse.json(
      { error: "Failed to get bookings" },
      { status: 500 }
    );
  }
}
