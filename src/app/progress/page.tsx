"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ProgressChart from "@/components/ProgressChart";
import Link from "next/link";

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

export default function ProgressPage() {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<TopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/progress", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load progress");
      const data = await res.json();
      setProgress(data.progress);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
            <p className="text-gray-600 mt-1">
              Track your mastery across topics over time.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchProgress}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
            >
              Refresh
            </button>
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="animate-pulse">
              <div className="h-64 bg-gray-100 rounded-lg mb-6" />
              <div className="flex gap-3">
                <div className="h-8 bg-gray-100 rounded-lg w-32" />
                <div className="h-8 bg-gray-100 rounded-lg w-28" />
                <div className="h-8 bg-gray-100 rounded-lg w-36" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Topic Mastery Over Time
            </h2>
            <ProgressChart progress={progress} />
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
