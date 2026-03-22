"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
  type: "upload" | "completed-note";
}

interface StudentFiles {
  student: {
    sub: string;
    email: string;
    name: string;
    username: string;
  };
  uploads: FileItem[];
  completedNotes: FileItem[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TutorFilesPage() {
  const { user, getToken, getIdToken } = useAuth();
  const [studentFiles, setStudentFiles] = useState<StudentFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(
    new Set()
  );

  const isTutor = user?.groups?.includes("tutors");

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const idToken = await getIdToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (idToken) {
        headers["x-id-token"] = idToken;
      }

      const res = await fetch("/api/tutor/all-files", { headers });
      if (!res.ok) throw new Error("Failed to load files");
      const data = await res.json();
      setStudentFiles(data.studentFiles);

      // Auto-expand all students
      const allSubs = new Set<string>(
        data.studentFiles.map((sf: StudentFiles) => sf.student.sub)
      );
      setExpandedStudents(allSubs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, getIdToken]);

  useEffect(() => {
    if (isTutor) {
      fetchFiles();
    } else {
      setLoading(false);
    }
  }, [isTutor, fetchFiles]);

  function toggleStudent(sub: string) {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) {
        next.delete(sub);
      } else {
        next.add(sub);
      }
      return next;
    });
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

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Student Files
            </h1>
            <p className="text-gray-600 mt-1">
              View all files uploaded by your students and your completed notes.
            </p>
          </div>
          <button
            onClick={fetchFiles}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-100 rounded w-64" />
                  <div className="h-4 bg-gray-100 rounded w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : studentFiles.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-300 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500 text-sm">
              No student files yet. Files will appear here once students upload
              them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {studentFiles.map(({ student, uploads, completedNotes }) => (
              <div
                key={student.sub}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Student header */}
                <button
                  onClick={() => toggleStudent(student.sub)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary-700">
                        {(student.name || student.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">
                        {student.name || student.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {uploads.length} upload{uploads.length !== 1 ? "s" : ""}{" "}
                        &middot; {completedNotes.length} completed note
                        {completedNotes.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedStudents.has(student.sub) ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Expanded file list */}
                {expandedStudents.has(student.sub) && (
                  <div className="border-t border-gray-100 px-6 py-4">
                    {/* Student Uploads */}
                    {uploads.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Student Uploads
                        </h3>
                        <div className="space-y-2">
                          {uploads.map((file) => (
                            <div
                              key={file.key}
                              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)} &middot;{" "}
                                  {formatDate(file.lastModified)}
                                </p>
                              </div>
                              <a
                                href={file.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1 rounded hover:bg-primary-50 transition-colors flex-shrink-0"
                              >
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed Notes */}
                    {completedNotes.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Completed Notes (uploaded by you)
                        </h3>
                        <div className="space-y-2">
                          {completedNotes.map((file) => (
                            <div
                              key={file.key}
                              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-green-50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 truncate">
                                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500 ml-4">
                                  {formatFileSize(file.size)} &middot;{" "}
                                  {formatDate(file.lastModified)}
                                </p>
                              </div>
                              <a
                                href={file.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1 rounded hover:bg-primary-50 transition-colors flex-shrink-0"
                              >
                                Download
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploads.length === 0 && completedNotes.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No files
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
