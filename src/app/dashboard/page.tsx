"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

interface Booking {
  id: string;
  scheduledAt: string;
  subject: string;
  status: string;
}

function formatSessionTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { user, getToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [credits, setCredits] = useState(0);
  const [referralMessage, setReferralMessage] = useState("");

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
    } finally {
      setLoadingBookings(false);
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
        setReferralMessage("Welcome! You received a free session credit from your referral!");
        fetchCredits();
      }
    } catch {
      // silently fail
    } finally {
      sessionStorage.removeItem("referralToken");
    }
  }, [isStudent, getToken, fetchCredits]);

  useEffect(() => {
    fetchBookings();
    fetchCredits();
    redeemReferral();
  }, [fetchBookings, fetchCredits, redeemReferral]);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.name || user?.email?.split("@")[0] || user?.username}
          </p>
        </div>

        {user?.groups?.includes("tutors") ? (
          /* ── Tutor Dashboard ── */
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              href="/tutor/files"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Student Files</h2>
              <p className="text-sm text-gray-600">View all files uploaded by your students, organized by student.</p>
            </Link>
            <Link
              href="/tutor/upload"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload Notes for Students</h2>
              <p className="text-sm text-gray-600">Upload completed session notes and materials for your students to access.</p>
            </Link>
            <Link
              href="/tutor/session-notes"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Session Notes</h2>
              <p className="text-sm text-gray-600">Write session notes for each student and view their session history.</p>
            </Link>
            <Link
              href="/tutor/schedule"
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Schedule</h2>
              <p className="text-sm text-gray-600">Set your availability, block off dates, and view upcoming booked sessions.</p>
            </Link>
          </div>
        ) : (
          /* ── Student Dashboard ── */
          <div className="space-y-6">
            {/* Referral welcome message */}
            {referralMessage && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                <p className="text-sm text-purple-800 font-medium">{referralMessage}</p>
              </div>
            )}

            {/* Free credits banner */}
            {credits > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🎉</span>
                <p className="text-sm text-green-800 font-medium">
                  You have {credits} free session credit{credits !== 1 ? "s" : ""}! Use it when booking your next session.
                </p>
              </div>
            )}

            {/* Top Row: Book a Session + My Progress */}
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/book-session"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Book a Session</h2>
                <p className="text-sm text-gray-600">View available time slots and book your next tutoring session.</p>
              </Link>
              <Link
                href="/progress"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">My Progress</h2>
                <p className="text-sm text-gray-600">Track your topic mastery and see how you&apos;re improving over time.</p>
              </Link>
            </div>

            {/* Upcoming Sessions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Sessions</h2>
                <Link
                  href="/book-session"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View All
                </Link>
              </div>
              {loadingBookings ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-100 rounded w-48 mb-1" />
                        <div className="h-3 bg-gray-50 rounded w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-6">
                  <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No upcoming sessions</p>
                  <Link href="/book-session" className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-1 inline-block">
                    Book one now
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.slice(0, 5).map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-100 rounded-lg"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {formatSessionTime(booking.scheduledAt)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {booking.subject || "Tutoring Session"}
                        </p>
                      </div>
                      {zoomLink ? (
                        <a
                          href={zoomLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Join Zoom
                        </a>
                      ) : (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          Scheduled
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: remaining icons */}
            <div className="grid md:grid-cols-2 gap-6">
              <Link
                href="/my-files"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload Questions for Tutor</h2>
                <p className="text-sm text-gray-600">Upload homework, practice problems, and questions for your tutor to review.</p>
              </Link>
              <Link
                href="/completed-notes"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Completed Notes</h2>
                <p className="text-sm text-gray-600">Access session notes and solutions uploaded by your tutor after each session.</p>
              </Link>
              <Link
                href="/session-history"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
                  <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Session History</h2>
                <p className="text-sm text-gray-600">View notes and summaries from your tutoring sessions.</p>
              </Link>
              <Link
                href="/settings"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-200 transition-colors">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Settings</h2>
                <p className="text-sm text-gray-600">Add a parent email to receive session note notifications.</p>
              </Link>
              <Link
                href="/referrals"
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Refer a Friend</h2>
                <p className="text-sm text-gray-600">Invite friends and earn free session credits.</p>
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Info
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Email:</span>
              <span className="text-gray-900">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Username:</span>
              <span className="text-gray-900">{user?.username}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Role:</span>
              <span className="text-gray-900">
                {user?.groups?.includes("tutors") ? "Tutor" : "Student"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
