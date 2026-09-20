"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import WeeklyBlocksEditor from "@/components/WeeklyBlocksEditor";
import TutorHoursCalendar from "@/components/TutorHoursCalendar";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { withTutorSub } from "@/lib/tutor-query";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";

// ADR-0009: shared-login two-tutor scheduling. Unset by default, which makes
// the "acting as" switcher below disappear entirely and this page behave
// exactly as it did for a single tutor.
const SECOND_TUTOR_SUB = process.env.NEXT_PUBLIC_SECOND_TUTOR_SUB || "";
const SECOND_TUTOR_NAME = process.env.NEXT_PUBLIC_SECOND_TUTOR_NAME || "Second Tutor";
const FOUNDER_NAME = process.env.NEXT_PUBLIC_FOUNDER_NAME || "Karsten";

interface BookedSession {
  id: string;
  studentEmail: string;
  studentName: string;
  tutorName: string;
  scheduledAt: string;
  subject: string;
  duration: number;
  paidWithCredit?: boolean;
}

export default function TutorSchedulePage() {
  return (
    <Suspense fallback={null}>
      <TutorScheduleContent />
    </Suspense>
  );
}

function TutorScheduleContent() {
  const { getToken, getIdToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const actingAsSecond = !!SECOND_TUTOR_SUB && searchParams.get("as") === "second";
  const actingAsTutorSub = actingAsSecond ? SECOND_TUTOR_SUB : undefined;

  function setActingAsSecond(second: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (second) params.set("as", "second");
    else params.delete("as");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const [activeTab, setActiveTab] = useState<
    "availability" | "blocks" | "sessions" | "calendar"
  >("availability");
  const [sessions, setSessions] = useState<BookedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [meetingRoomUrl, setMeetingRoomUrl] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const token = await getToken();
      const idToken = await getIdToken();
      if (!token) return;
      const res = await fetch(withTutorSub("/api/tutor/profile", actingAsTutorSub), {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMeetingRoomUrl(data.meetingRoomUrl || "");
      }
    }
    loadProfile();
  }, [getToken, getIdToken, actingAsTutorSub]);

  async function saveMeetingRoom() {
    setSavingRoom(true);
    setRoomMessage(null);
    try {
      const token = await getToken();
      const idToken = await getIdToken();
      const res = await fetch(withTutorSub("/api/tutor/profile", actingAsTutorSub), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
        body: JSON.stringify({ meetingRoomUrl }),
      });
      if (!res.ok) throw new Error("Save failed");
      setRoomMessage("Saved!");
    } catch {
      setRoomMessage("Failed to save");
    } finally {
      setSavingRoom(false);
      setTimeout(() => setRoomMessage(null), 3000);
    }
  }
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));

  const weekEnd = endOfWeek(weekStart);

  useEffect(() => {
    if (activeTab !== "sessions") return;

    async function loadSessions() {
      const token = await getToken();
      const idToken = await getIdToken();
      if (!token) return;

      setLoadingSessions(true);
      try {
        const start = format(weekStart, "yyyy-MM-dd");
        const end = format(endOfWeek(weekStart), "yyyy-MM-dd");

        const res = await fetch(
          `/api/tutor/bookings?startDate=${start}&endDate=${end}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(idToken ? { "x-id-token": idToken } : {}),
            },
          }
        );
        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        setLoadingSessions(false);
      }
    }

    loadSessions();
  }, [activeTab, weekStart, getToken, getIdToken]);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Schedule Management
        </h1>

        {SECOND_TUTOR_SUB && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500 mr-1">Acting as:</span>
            <button
              onClick={() => setActingAsSecond(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !actingAsSecond
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {FOUNDER_NAME}
            </button>
            <button
              onClick={() => setActingAsSecond(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                actingAsSecond
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {SECOND_TUTOR_NAME}
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">
            {actingAsSecond ? `${SECOND_TUTOR_NAME}'s Meeting Room` : "Your Meeting Room"}
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            This link goes out on every confirmation, reminder, and dashboard
            "Join Zoom Now" button for sessions assigned to{" "}
            {actingAsSecond ? SECOND_TUTOR_NAME : "you"}.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={meetingRoomUrl}
              onChange={(e) => setMeetingRoomUrl(e.target.value)}
              placeholder="https://zoom.us/j/your-personal-meeting-id"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={saveMeetingRoom}
              disabled={savingRoom}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingRoom ? "Saving..." : "Save"}
            </button>
          </div>
          {roomMessage && (
            <p className="text-xs text-gray-500 mt-2">{roomMessage}</p>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { id: "availability" as const, label: "Set Base Hours" },
            { id: "blocks" as const, label: "Block Off Next 2 Weeks" },
            { id: "sessions" as const, label: "Upcoming Sessions" },
            ...(SECOND_TUTOR_SUB
              ? [{ id: "calendar" as const, label: "Calendar" }]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: activeTab === "availability" ? "block" : "none" }}>
          <p className="text-sm text-gray-600 mb-4">
            Set your weekly base hours. These recur every week unless you block
            time off for a specific day.
          </p>
          <AvailabilityEditor
            getToken={getToken}
            getIdToken={getIdToken}
            actingAsTutorSub={actingAsTutorSub}
          />
        </div>

        {activeTab === "blocks" && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Block off specific time ranges for the upcoming 14 days. Blocks
              subtract from your base hours.
            </p>
            <WeeklyBlocksEditor
              getToken={getToken}
              getIdToken={getIdToken}
              actingAsTutorSub={actingAsTutorSub}
            />
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h2 className="text-md font-semibold text-gray-900">
                {format(weekStart, "MMM d")} –{" "}
                {format(weekEnd, "MMM d, yyyy")}
              </h2>
              <button
                onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {loadingSessions ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-gray-100 rounded-xl h-16"
                  />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm">
                  No sessions booked for this week.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledAt).getTime() -
                      new Date(b.scheduledAt).getTime()
                  )
                  .map((session) => (
                    <div
                      key={session.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {session.subject}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(
                              parseISO(session.scheduledAt),
                              "EEEE, MMMM d 'at' h:mm a"
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">
                            {session.studentName || session.studentEmail}
                          </p>
                          <div className="flex items-center gap-1.5 justify-end">
                            {session.tutorName && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                {session.tutorName}
                              </span>
                            )}
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              Booked
                            </span>
                            {session.paidWithCredit && (
                              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                Free
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "calendar" && SECOND_TUTOR_SUB && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              The next 7 days, blocks already subtracted — {FOUNDER_NAME} in red,{" "}
              {SECOND_TUTOR_NAME} in blue.
            </p>
            <TutorHoursCalendar
              getToken={getToken}
              founderName={FOUNDER_NAME}
              secondTutorName={SECOND_TUTOR_NAME}
              secondTutorSub={SECOND_TUTOR_SUB}
            />
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
