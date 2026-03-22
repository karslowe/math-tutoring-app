"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

interface Student {
  sub: string;
  email: string;
  username: string;
}

interface SessionNote {
  id: string;
  studentSub: string;
  studentEmail: string;
  scheduledAt: string;
  subject: string;
  notes: string;
  status: string;
  createdAt: string;
}

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  useEffect(() => {
    if (selectedStudent) {
      fetchSessions(selectedStudent);
    } else {
      setSessions([]);
    }
  }, [selectedStudent, fetchSessions]);

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

      const res = await fetch("/api/tutor/session-notes", {
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note");
      }

      setSuccess("Session note saved successfully!");
      setSubject("");
      setNotes("");
      fetchSessions(selectedStudent);
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

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Session Notes</h1>
          <p className="text-gray-600 mt-1">
            Write session notes for each student and view their session history.
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
                setSuccess("");
                setError("");
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">-- Choose a student --</option>
              {students.map((s) => (
                <option key={s.sub} value={s.sub}>
                  {s.email} ({s.username})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedStudent && (
          <>
            {/* New Note Form */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Add Session Note for {selectedStudentInfo?.email}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <button
                  type="submit"
                  disabled={submitting || !notes.trim()}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Save Session Note"}
                </button>
              </form>
            </div>

            {/* Session History */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Session History
                </h2>
                <span className="text-sm text-gray-500">
                  {sessions.length} session
                  {sessions.length !== 1 ? "s" : ""}
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
              ) : sessions.length === 0 ? (
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
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="border-l-4 border-primary-300 pl-4 py-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {session.subject}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(session.scheduledAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {session.notes}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
