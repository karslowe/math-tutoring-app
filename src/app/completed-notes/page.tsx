"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FileList } from "@/components/FileList";

interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
}

export default function CompletedNotesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/tutor/files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Completed Notes</h1>
          <p className="text-gray-600 mt-1">
            Session notes and solutions uploaded by your tutor. These are your
            completed materials from past sessions.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Tutor-uploaded materials
              </p>
              <p className="text-sm text-blue-700 mt-0.5">
                These files are uploaded by your tutor after each session. You
                can download them anytime for review.
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Notes
            </h2>
            <button
              onClick={fetchNotes}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Refresh
            </button>
          </div>
          <FileList files={files} loading={loading} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
