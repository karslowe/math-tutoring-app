"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import { isSameDay, format } from "date-fns";
import ProgressChart from "@/components/ProgressChart";
import { MiniCalendar } from "@/components/MiniCalendar";
import { PdfThumbnail } from "@/components/PdfThumbnail";

interface Booking {
  id: string;
  scheduledAt: string;
  subject: string;
  status: string;
}

interface CompletedNote {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
}

interface TopicProgressEntry {
  topicName: string;
  level: string;
  numericLevel: number;
  date: string;
  sessionId: string;
}

interface TopicSummary {
  topicName: string;
  currentLevel: string;
  numericLevel: number;
  history: TopicProgressEntry[];
}

function isImageFile(name: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(name);
}

function isPdfFile(name: string): boolean {
  return /\.pdf$/i.test(name);
}

export default function DashboardPage() {
  const { user, getToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [credits, setCredits] = useState(0);
  const [referralMessage, setReferralMessage] = useState("");
  const [familyMessage, setFamilyMessage] = useState("");
  const [progress, setProgress] = useState<TopicSummary[]>([]);
  const [completedNotes, setCompletedNotes] = useState<CompletedNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const isStudent = !user?.groups?.includes("tutors");
  const zoomLink = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

  const fetchBookings = useCallback(async () => {
    if (!isStudent) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch {
      // silently fail
    }
  }, [isStudent, getToken]);

  const fetchCredits = useCallback(async () => {
    if (!isStudent) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/profile/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || 0);
      }
    } catch {
      // silently fail
    }
  }, [isStudent, getToken]);

  const fetchProgress = useCallback(async () => {
    if (!isStudent) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/progress", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProgress(data.progress || []);
      }
    } catch {
      // silently fail
    }
  }, [isStudent, getToken]);

  const fetchCompletedNotes = useCallback(async () => {
    if (!isStudent) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/tutor/files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompletedNotes(data.files || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingNotes(false);
    }
  }, [isStudent, getToken]);

  // Save phone collected at signup (after first login).
  const savePendingPhone = useCallback(async () => {
    const pending = sessionStorage.getItem("pendingPhone");
    if (!pending) return;
    try {
      const token = await getToken();
      await fetch("/api/profile/phone", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: pending }),
      });
    } catch {
      // silently fail
    } finally {
      sessionStorage.removeItem("pendingPhone");
    }
  }, [getToken]);

  // Redeem referral token from sessionStorage (after signup)
  const redeemReferral = useCallback(async () => {
    if (!isStudent) return;
    const referralToken = sessionStorage.getItem("referralToken");
    if (!referralToken) return;

    try {
      const token = await getToken();
      const res = await fetch("/api/referrals/redeem", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: referralToken }),
      });

      if (res.ok) {
        setReferralMessage(
          "Welcome! You were referred by a friend — enjoy your first session!"
        );
      }
    } catch {
      // silently fail
    } finally {
      sessionStorage.removeItem("referralToken");
    }
  }, [isStudent, getToken]);

  // Always probe for a pending family invite linked to this user's email.
  const redeemFamilyInvite = useCallback(async () => {
    try {
      const familyToken = sessionStorage.getItem("familyInviteToken");
      const token = await getToken();
      const res = await fetch("/api/family/invitations/redeem", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(familyToken ? { token: familyToken } : {}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const who = data.parentName || data.parentEmail || "your parent";
          setFamilyMessage(`Account linked to ${who}.`);
        }
      }
    } catch {
      // silently fail
    } finally {
      sessionStorage.removeItem("familyInviteToken");
    }
  }, [getToken]);

  useEffect(() => {
    // Run signup-side-effects first so the household link is persisted before
    // the data fetches resolve. Then load everything the dashboard renders.
    (async () => {
      await Promise.all([
        savePendingPhone(),
        redeemReferral(),
        redeemFamilyInvite(),
      ]);
      await Promise.all([
        fetchBookings(),
        fetchCredits(),
        fetchProgress(),
        fetchCompletedNotes(),
      ]);
    })();
  }, [
    fetchBookings,
    fetchCredits,
    fetchProgress,
    fetchCompletedNotes,
    redeemReferral,
    redeemFamilyInvite,
    savePendingPhone,
  ]);

  const todaySession = bookings.find((b) =>
    isSameDay(new Date(b.scheduledAt), new Date())
  );

  const isTutorView = user?.groups?.includes("tutors");

  return (
    <ProtectedRoute>
      <div
        className={
          isTutorView
            ? "max-w-7xl mx-auto px-4 py-6"
            : "max-w-7xl mx-auto px-4 py-3 lg:h-[calc(100dvh-3.5rem)] lg:flex lg:flex-col w-full"
        }
      >
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">
            Welcome back, {user?.name || user?.email?.split("@")[0]}
            {credits > 0 && (
              <span className="ml-2 text-xs font-medium text-green-700">
                · {credits} free credit{credits !== 1 ? "s" : ""}
              </span>
            )}
          </h1>
          {(referralMessage || familyMessage) && (
            <span className="text-xs text-blue-700 truncate max-w-md">
              {familyMessage || referralMessage}
            </span>
          )}
        </div>

        {isTutorView ? (
          /* ── Tutor Dashboard (unchanged) ── */
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/tutor/files"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Student Files
              </h2>
              <p className="text-sm text-gray-600">
                View files uploaded by your students.
              </p>
            </Link>
            <Link
              href="/tutor/upload"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Upload Notes
              </h2>
              <p className="text-sm text-gray-600">
                Upload completed session notes for students.
              </p>
            </Link>
            <Link
              href="/tutor/session-notes"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Session Notes
              </h2>
              <p className="text-sm text-gray-600">
                Write session notes and view session history.
              </p>
            </Link>
            <Link
              href="/tutor/schedule"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Schedule
              </h2>
              <p className="text-sm text-gray-600">
                Manage availability and view upcoming sessions.
              </p>
            </Link>
          </div>
        ) : (
          /* ── Student Dashboard: 4-quadrant viewport-fit layout ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-3 flex-1 min-h-0">
            {/* Top-left: Progress visualization */}
            <div className="bg-white/95 rounded-2xl p-3 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">
                  Your Progress
                </h2>
                <Link
                  href="/progress"
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Details →
                </Link>
              </div>
              {progress.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  Progress will appear after your first session.
                </div>
              ) : (
                <div className="flex-1 min-h-0">
                  <ProgressChart progress={progress} compact />
                </div>
              )}
            </div>

            {/* Top-right: Calendar (or Zoom-now if session today) */}
            <div className="bg-white/95 rounded-2xl p-3 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] flex flex-col min-h-0 overflow-hidden">
              {todaySession ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Session Today
                  </h2>
                  <p className="text-xs text-gray-600 mb-3">
                    {format(new Date(todaySession.scheduledAt), "h:mm a")}
                    {todaySession.subject ? ` · ${todaySession.subject}` : ""}
                  </p>
                  {zoomLink ? (
                    <a
                      href={zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-primary-600 hover:bg-primary-700 hover:shadow-md text-white px-6 py-2.5 rounded-full font-medium text-sm transition-all"
                    >
                      Join Zoom Now
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400">
                      No Zoom link configured
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Calendar
                    </h2>
                    <Link
                      href="/book-session"
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      Book →
                    </Link>
                  </div>
                  <div className="flex-1 min-h-0">
                    <MiniCalendar sessions={bookings} />
                  </div>
                </>
              )}
            </div>

            {/* Bottom-left: Completed notes thumbnails */}
            <div className="bg-white/95 rounded-2xl p-3 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-1 flex-shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">
                  Completed Notes
                </h2>
                <Link
                  href="/completed-notes"
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  All →
                </Link>
              </div>
              {loadingNotes ? (
                <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-gray-100 animate-pulse rounded"
                    />
                  ))}
                </div>
              ) : completedNotes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  No completed notes yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 flex-1 min-h-0 overflow-y-auto auto-rows-fr pr-1">
                  {completedNotes.slice(0, 6).map((note) => (
                    <a
                      key={note.key}
                      href={note.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col min-h-0"
                      title={note.name}
                    >
                      <div className="flex-1 bg-gray-50 rounded border border-gray-200 overflow-hidden group-hover:border-primary-400 transition-colors min-h-0">
                        {isImageFile(note.name) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={note.downloadUrl}
                            alt={note.name}
                            className="w-full h-full object-cover"
                          />
                        ) : isPdfFile(note.name) ? (
                          <PdfThumbnail url={note.downloadUrl} />
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-gray-400">
                            {note.name.split(".").pop()?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 truncate group-hover:text-gray-900 leading-tight mt-1">
                        {note.name}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom-right: 3 quick-action icons */}
            <div className="bg-white/95 rounded-2xl p-3 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] flex flex-col min-h-0 overflow-hidden">
              <h2 className="text-sm font-semibold text-gray-900 mb-2 flex-shrink-0">
                Quick Actions
              </h2>
              <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
                <Link
                  href="/my-files"
                  className="flex flex-col items-center justify-center rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors p-2"
                >
                  <svg
                    className="w-7 h-7 text-violet-600 mb-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">
                    Upload Notes
                  </span>
                </Link>
                <Link
                  href="/referrals"
                  className="flex flex-col items-center justify-center rounded-xl border border-gray-200 hover:border-fuchsia-300 hover:bg-fuchsia-50 transition-colors p-2"
                >
                  <svg
                    className="w-7 h-7 text-fuchsia-600 mb-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">
                    Refer a Friend
                  </span>
                </Link>
                <Link
                  href="/session-history"
                  className="flex flex-col items-center justify-center rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors p-2"
                >
                  <svg
                    className="w-7 h-7 text-purple-600 mb-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">
                    Session History
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
