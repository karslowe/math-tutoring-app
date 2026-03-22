"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import Link from "next/link";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";

interface BookedSession {
  id: string;
  studentEmail: string;
  scheduledAt: string;
  subject: string;
  duration: number;
}

interface DateOverrideItem {
  sk: string; // YYYY-MM-DD
  available: boolean;
}

export default function TutorSchedulePage() {
  const { getToken, getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "availability" | "sessions" | "overrides"
  >("availability");
  const [sessions, setSessions] = useState<BookedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));

  // Override state
  const [overrideDate, setOverrideDate] = useState("");
  const [overrides, setOverrides] = useState<DateOverrideItem[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState("");

  const weekEnd = endOfWeek(weekStart);

  // Load sessions when tab is active or week changes
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

  // Load overrides when tab is active
  useEffect(() => {
    if (activeTab !== "overrides") return;

    async function loadOverrides() {
      const token = await getToken();
      if (!token) return;

      setLoadingOverrides(true);
      try {
        const res = await fetch(
          `/api/availability/overrides?startDate=2020-01-01&endDate=2030-12-31`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setOverrides(data.overrides || []);
      } catch (error) {
        console.error("Failed to load overrides:", error);
      } finally {
        setLoadingOverrides(false);
      }
    }

    loadOverrides();
  }, [activeTab, getToken]);

  async function refreshOverrides() {
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(
        `/api/availability/overrides?startDate=2020-01-01&endDate=2030-12-31`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setOverrides(data.overrides || []);
    } catch (error) {
      console.error("Failed to refresh overrides:", error);
    }
  }

  async function handleBlockDate() {
    if (!overrideDate) return;
    setSavingOverride(true);
    setOverrideMessage("");

    try {
      const token = await getToken();
      const idToken = await getIdToken();

      const res = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
        body: JSON.stringify({
          date: overrideDate,
          available: false,
          slots: [],
        }),
      });

      if (!res.ok) throw new Error("Failed to save override");
      setOverrideMessage(`Blocked ${overrideDate}`);
      setOverrideDate("");
      await refreshOverrides();
    } catch (error) {
      setOverrideMessage("Failed to block date");
    } finally {
      setSavingOverride(false);
      setTimeout(() => setOverrideMessage(""), 3000);
    }
  }

  async function handleRemoveOverride(date: string) {
    try {
      const token = await getToken();
      const idToken = await getIdToken();

      await fetch(`/api/availability/overrides?date=${date}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
      });
      await refreshOverrides();
    } catch (error) {
      console.error("Failed to remove override:", error);
    }
  }

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

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Schedule Management
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "availability" as const, label: "Set Availability" },
            { id: "overrides" as const, label: "Block Off Dates" },
            { id: "sessions" as const, label: "Upcoming Sessions" },
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

        {/* Availability tab — use display:none to keep state alive */}
        <div style={{ display: activeTab === "availability" ? "block" : "none" }}>
          <p className="text-sm text-gray-600 mb-4">
            Set your weekly availability. Add time windows for each day you want
            to offer tutoring sessions.
          </p>
          <AvailabilityEditor getToken={getToken} getIdToken={getIdToken} />
        </div>

        {/* Overrides tab */}
        {activeTab === "overrides" && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Block off specific dates when you are unavailable, regardless of
              your weekly schedule.
            </p>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleBlockDate}
                  disabled={!overrideDate || savingOverride}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {savingOverride ? "Blocking..." : "Block This Date"}
                </button>
              </div>
              {overrideMessage && (
                <p className="text-sm text-gray-600 mt-2">{overrideMessage}</p>
              )}
            </div>

            {/* List of blocked dates */}
            {loadingOverrides ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-gray-100 rounded-xl h-14"
                  />
                ))}
              </div>
            ) : overrides.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
                <p className="text-gray-500 text-sm">No blocked dates.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overrides
                  .sort((a, b) => a.sk.localeCompare(b.sk))
                  .map((override) => (
                    <div
                      key={override.sk}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm font-medium text-gray-900">
                          {format(
                            parseISO(override.sk),
                            "EEEE, MMMM d, yyyy"
                          )}
                        </span>
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          Blocked
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveOverride(override.sk)}
                        className="text-sm text-gray-500 hover:text-red-600 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Sessions tab */}
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
                            {session.studentEmail}
                          </p>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            Booked
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
