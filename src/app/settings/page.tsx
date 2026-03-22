"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SettingsPage() {
  const { user, getToken } = useAuth();
  const [parentEmail, setParentEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchParentEmail() {
      try {
        const token = await getToken();
        const res = await fetch("/api/profile/parent-email", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setParentEmail(data.parentEmail || "");
          setSavedEmail(data.parentEmail || "");
        }
      } catch (err: any) {
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    fetchParentEmail();
  }, [getToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      const res = await fetch("/api/profile/parent-email", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parentEmail: parentEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSavedEmail(parentEmail.trim());
      setSuccess("Parent email saved successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account preferences and notification settings.
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

        {/* Account Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-24">Email:</span>
              <span className="text-gray-900">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-24">Username:</span>
              <span className="text-gray-900">{user?.username}</span>
            </div>
          </div>
        </div>

        {/* Parent Email */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Parent/Guardian Email
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Add a parent or guardian email to receive copies of your session
            notes. When your tutor writes session notes, they&apos;ll be emailed
            to both you and your parent.
          </p>

          {loading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Email Address
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => {
                    setParentEmail(e.target.value);
                    setSuccess("");
                  }}
                  placeholder="parent@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {savedEmail && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Session notes will also be sent to{" "}
                  <strong>{savedEmail}</strong>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {parentEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setParentEmail("");
                      setSuccess("");
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
