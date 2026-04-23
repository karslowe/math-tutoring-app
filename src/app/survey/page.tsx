"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const SUBJECTS = [
  "SAT/ACT",
  "6th",
  "7th",
  "8th",
  "Algebra 1",
  "Algebra 2",
  "Geometry",
  "Pre-Calculus",
  "Calculus AB",
  "Calculus BC",
];

const GOALS = [
  "Need help",
  "For fun",
  "To get ahead",
  "To do well on SAT or ACT",
];

export default function SurveyPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = subject && goal && !submitting;

  async function handleSubmit() {
    if (!subject || !goal) return;
    setSubmitting(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/profile/survey", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, goal }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save survey");
      }
      router.push("/book-session");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome! Let&apos;s get you set up
          </h1>
          <p className="text-gray-600 mt-1">
            Tell us a bit about what you&apos;re looking for so we can tailor
            your sessions.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Which subject do you want to focus on?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  subject === s
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What&apos;s your goal?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  goal === g
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Saving..." : "Continue to booking"}
        </button>
      </div>
    </ProtectedRoute>
  );
}
