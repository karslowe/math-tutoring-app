"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.email?.split("@")[0] || user?.username}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/my-files"
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
              <svg
                className="w-6 h-6 text-primary-600"
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
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              My Files
            </h2>
            <p className="text-sm text-gray-600">
              Upload homework, practice problems, and materials for your
              tutoring sessions.
            </p>
          </Link>

          <Link
            href="/completed-notes"
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Completed Notes
            </h2>
            <p className="text-sm text-gray-600">
              Access session notes and solutions uploaded by your tutor after
              each session.
            </p>
          </Link>
        </div>

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
