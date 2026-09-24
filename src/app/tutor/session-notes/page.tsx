"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ProgressChart, { TopicTag } from "@/components/ProgressChart";
import Link from "next/link";
import { withTutorSub } from "@/lib/tutor-query";

// ADR-0009: only used for a note with no underlying booking (a walk-in or
// make-up lesson) — a note tied to an existing booking is always attributed
// to whichever tutor that booking was actually assigned to, regardless of
// who's logged in when the note gets written.
const SECOND_TUTOR_SUB = process.env.NEXT_PUBLIC_SECOND_TUTOR_SUB || "";
const SECOND_TUTOR_NAME = process.env.NEXT_PUBLIC_SECOND_TUTOR_NAME || "Second Tutor";
const FOUNDER_NAME = process.env.NEXT_PUBLIC_FOUNDER_NAME || "Karsten";

interface Student {
  sub: string;
  email: string;
  name: string;
  username: string;
}

interface TopicMastery {
  name: string;
  level: "Learning" | "Practicing" | "Getting It" | "Mastered";
}

interface SessionAttachment {
  key: string;
  name: string;
  uploadedAt: string;
  url: string;
}

interface SessionNote {
  id: string;
  studentSub: string;
  studentEmail: string;
  scheduledAt: string;
  subject: string;
  notes: string;
  topics?: TopicMastery[];
  status: string;
  createdAt: string;
  tutorName?: string;
  attachments?: SessionAttachment[];
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

const MASTERY_OPTIONS: TopicMastery["level"][] = [
  "Learning",
  "Practicing",
  "Getting It",
  "Mastered",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TutorSessionNotesPage() {
  const { user, getToken, getIdToken } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [sessions, setSessions] = useState<SessionNote[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [actingAsSecond, setActingAsSecond] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Topic mastery state
  const [topics, setTopics] = useState<TopicMastery[]>([]);
  const [topicName, setTopicName] = useState("");
  const [topicLevel, setTopicLevel] = useState<TopicMastery["level"]>("Learning");

  // Progress chart state
  const [progress, setProgress] = useState<TopicSummary[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"notes" | "history" | "progress">("notes");

  const isTutor = user?.groups?.includes("tutors");

  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();
    const idToken = await getIdToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (idToken) {
      headers["x-id-token"] = idToken;
    }
    return headers;
  }, [getToken, getIdToken]);

  // Fetch students
  useEffect(() => {
    async function fetchStudents() {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/tutor/students", { headers });
        if (!res.ok) throw new Error("Failed to load students");
        const data = await res.json();
        setStudents(data.students);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingStudents(false);
      }
    }

    if (isTutor) {
      fetchStudents();
    } else {
      setLoadingStudents(false);
    }
  }, [isTutor, getAuthHeaders]);

  // Fetch session notes when student is selected
  const fetchSessions = useCallback(
    async (studentSub: string) => {
      if (!studentSub) {
        setSessions([]);
        return;
      }
      setLoadingSessions(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/tutor/session-notes?studentSub=${studentSub}`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed to load session notes");
        const data = await res.json();
        setSessions(data.sessions);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingSessions(false);
      }
    },
    [getAuthHeaders]
  );

  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<
    string | null
  >(null);

  async function handleAttachmentUpload(sessionId: string, file: File) {
    setUploadingAttachmentFor(sessionId);
    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);
      const res = await fetch("/api/tutor/session-notes/attachments", {
        method: "POST",
        headers,
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to attach file");
      }
      if (selectedStudent) {
        await fetchSessions(selectedStudent);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAttachmentFor(null);
    }
  }

  // Fetch progress when student is selected
  const fetchProgress = useCallback(
    async (studentSub: string) => {
      if (!studentSub) {
        setProgress([]);
        return;
      }
      setLoadingProgress(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/tutor/progress?studentSub=${studentSub}`,
          { headers }
        );
        if (!res.ok) throw new Error("Failed to load progress");
        const data = await res.json();
        setProgress(data.progress);
      } catch (err: any) {
        console.error("Progress fetch error:", err);
      } finally {
        setLoadingProgress(false);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (selectedStudent) {
      fetchSessions(selectedStudent);
      fetchProgress(selectedStudent);
    } else {
      setSessions([]);
      setProgress([]);
    }
  }, [selectedStudent, fetchSessions, fetchProgress]);

  function addTopic() {
    const trimmed = topicName.trim();
    if (!trimmed) return;
    // Don't add duplicate topic names
    if (topics.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setTopics([...topics, { name: trimmed, level: topicLevel }]);
    setTopicName("");
    setTopicLevel("Learning");
  }

  function removeTopic(index: number) {
    setTopics(topics.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !notes.trim()) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const headers = await getAuthHeaders();
      const selectedStudentInfo = students.find(
        (s) => s.sub === selectedStudent
      );

      const url = selectedSessionId
        ? "/api/tutor/session-notes"
        : withTutorSub("/api/tutor/session-notes", actingAsSecond ? SECOND_TUTOR_SUB : undefined);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentSub: selectedStudent,
          studentEmail: selectedStudentInfo?.email || "",
          subject: subject.trim() || "General Math",
          notes: notes.trim(),
          topics: topics.length > 0 ? topics : undefined,
          sessionId: selectedSessionId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note");
      }

      setSuccess("Session note saved successfully!");
      setSubject("");
      setNotes("");
      setTopics([]);
      setSelectedSessionId("");
      fetchSessions(selectedStudent);
      fetchProgress(selectedStudent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isTutor) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Tutor Access Required
            </h2>
            <p className="text-red-600 text-sm">
              This page is only accessible to tutors.
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const selectedStudentInfo = students.find((s) => s.sub === selectedStudent);
  // Only actual scheduled bookings can be picked for notes — a completed one
  // has already been logged, and history should only show what's logged.
  const scheduledSessions = sessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const historySessions = sessions.filter((s) => s.status === "completed");

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Session Notes</h1>
          <p className="text-gray-600 mt-1">
            Write session notes, track topic mastery, and view student progress.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
            {success}
          </div>
        )}

        {/* Student Selector */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Student
          </label>
          {loadingStudents ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : students.length === 0 ? (
            <p className="text-sm text-gray-500">
              No students found. Students need to sign up first.
            </p>
          ) : (
            <select
              value={selectedStudent}
              onChange={(e) => {
                setSelectedStudent(e.target.value);
                setSelectedSessionId("");
                setSuccess("");
                setError("");
                setActiveTab("notes");
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">-- Choose a student --</option>
              {students.map((s) => (
                <option key={s.sub} value={s.sub}>
                  {s.name || s.email} ({s.username})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedStudent && (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
              {[
                { key: "notes" as const, label: "Add Note" },
                { key: "history" as const, label: "Session History" },
                { key: "progress" as const, label: "Progress" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Add Note Tab */}
            {activeTab === "notes" && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Add Session Note for {selectedStudentInfo?.name || selectedStudentInfo?.email}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Which session is this for?
                    </label>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    >
                      <option value="">Not tied to a specific booking (walk-in / make-up)</option>
                      {scheduledSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatDate(s.scheduledAt)}
                          {s.tutorName ? ` — ${s.tutorName}` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedSessionId ? (
                      <p className="text-xs text-gray-500 mt-1">
                        This note attaches to that booking and is credited to whichever
                        tutor was actually assigned to it.
                      </p>
                    ) : (
                      SECOND_TUTOR_SUB && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">Logged for:</span>
                          <button
                            type="button"
                            onClick={() => setActingAsSecond(false)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              !actingAsSecond
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {FOUNDER_NAME}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActingAsSecond(true)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              actingAsSecond
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {SECOND_TUTOR_NAME}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Algebra, Calculus, Geometry..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Notes *
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Write your session notes here..."
                      rows={5}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                    />
                  </div>

                  {/* Topics Covered Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics Covered
                    </label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTopic();
                          }
                        }}
                        placeholder="Topic name..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <select
                        value={topicLevel}
                        onChange={(e) =>
                          setTopicLevel(
                            e.target.value as TopicMastery["level"]
                          )
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                      >
                        {MASTERY_OPTIONS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addTopic}
                        disabled={!topicName.trim()}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>

                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {topics.map((topic, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-medium text-gray-700">
                              {topic.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${
                                topic.level === "Learning"
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : topic.level === "Practicing"
                                  ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                  : topic.level === "Getting It"
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : "bg-green-100 text-green-700 border-green-200"
                              }`}
                            >
                              {topic.level}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTopic(i)}
                              className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !notes.trim()}
                    className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Saving..." : "Save Session Note"}
                  </button>
                </form>
              </div>
            )}

            {/* Session History Tab */}
            {activeTab === "history" && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Session History
                  </h2>
                  <span className="text-sm text-gray-500">
                    {historySessions.length} session
                    {historySessions.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {loadingSessions ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : historySessions.length === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      className="mx-auto h-10 w-10 text-gray-300 mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm">
                      No session notes yet for this student.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historySessions.map((session) => (
                      <div
                        key={session.id}
                        className="border-l-4 border-primary-300 pl-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {session.subject}
                          </span>
                          <span className="text-xs text-gray-400">&bull;</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(session.scheduledAt)}
                          </span>
                          {session.tutorName && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {session.tutorName}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {session.notes}
                        </p>
                        {session.topics && session.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {session.topics.map((topic, i) => (
                              <TopicTag
                                key={i}
                                name={topic.name}
                                level={topic.level}
                              />
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {session.attachments?.map((a) => (
                            <a
                              key={a.key}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                />
                              </svg>
                              {a.name}
                            </a>
                          ))}
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer px-2 py-1.5">
                            {uploadingAttachmentFor === session.id
                              ? "Uploading..."
                              : "+ Attach work"}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingAttachmentFor === session.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAttachmentUpload(session.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Progress Tab */}
            {activeTab === "progress" && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Topic Progress for {selectedStudentInfo?.name || selectedStudentInfo?.email}
                </h2>
                {loadingProgress ? (
                  <div className="animate-pulse">
                    <div className="h-64 bg-gray-100 rounded-lg mb-6" />
                    <div className="flex gap-3">
                      <div className="h-8 bg-gray-100 rounded-lg w-32" />
                      <div className="h-8 bg-gray-100 rounded-lg w-28" />
                    </div>
                  </div>
                ) : (
                  <ProgressChart progress={progress} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
