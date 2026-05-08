"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

interface FamilyInvitation {
  token: string;
  invitedStudentEmail: string;
  status: "pending" | "accepted";
  createdAt: string;
  expiresAt: string;
}

export default function SettingsPage() {
  const { user, getToken } = useAuth();
  const [parentEmail, setParentEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [familyInvitations, setFamilyInvitations] = useState<FamilyInvitation[]>(
    []
  );
  const [studentEmailInvite, setStudentEmailInvite] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const fetchFamilyInvitations = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/family/invitations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFamilyInvitations(data.invitations || []);
      }
    } catch {
      // silently fail
    }
  }, [getToken]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = await getToken();
        const [emailRes, phoneRes] = await Promise.all([
          fetch("/api/profile/parent-email", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/profile/phone", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (emailRes.ok) {
          const data = await emailRes.json();
          setParentEmail(data.parentEmail || "");
          setSavedEmail(data.parentEmail || "");
        }
        if (phoneRes.ok) {
          const data = await phoneRes.json();
          setPhone(data.phone || "");
          setSavedPhone(data.phone || "");
        }
      } catch {
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
    fetchFamilyInvitations();
  }, [getToken, fetchFamilyInvitations]);

  async function handleInviteStudent(e: React.FormEvent) {
    e.preventDefault();
    const email = studentEmailInvite.trim().toLowerCase();
    if (!email) return;
    setSendingInvite(true);
    setError("");
    setSuccess("");
    try {
      const token = await getToken();
      const res = await fetch("/api/family/invitations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitedStudentEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invite");
      }
      setSuccess(`Invite sent to ${email}.`);
      setStudentEmailInvite("");
      fetchFamilyInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleSaveParentEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
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
      setSuccess("Parent email saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault();
    setSavingPhone(true);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      const res = await fetch("/api/profile/phone", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      setSavedPhone(data.phone || "");
      setPhone(data.phone || "");
      setSuccess(data.phone ? "Phone number saved." : "Phone number cleared.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPhone(false);
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
        <div className="bg-white/95 rounded-2xl p-6 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-24">Email:</span>
              <span className="text-gray-900">{user?.email}</span>
            </div>
            {user?.name && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-24">Name:</span>
                <span className="text-gray-900">{user.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="bg-white/95 rounded-2xl p-6 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Phone Number
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Add a phone number so your tutor can reach you if email isn&apos;t
            working. We&apos;ll only use it for tutoring-related contact.
          </p>

          {loading ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <form onSubmit={handleSavePhone} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (any format)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSuccess("");
                  }}
                  placeholder="(415) 555-0123"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoComplete="tel"
                />
                <p className="text-xs text-gray-500 mt-1">
                  US numbers are auto-formatted; international numbers should
                  start with &quot;+&quot;.
                </p>
              </div>

              {savedPhone && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  Saved: <strong>{savedPhone}</strong>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={savingPhone}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {savingPhone ? "Saving..." : "Save"}
                </button>
                {phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhone("");
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

        {/* Parent Email */}
        <div className="bg-white/95 rounded-2xl p-6 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
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
            <form onSubmit={handleSaveParentEmail} className="space-y-4">
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
                  disabled={savingEmail}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {savingEmail ? "Saving..." : "Save"}
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

        {/* Connect Student Account */}
        <div className="bg-white/95 rounded-2xl p-6 border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Connect Student Account
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Invite a student so they get their own login linked to your
            account. They&apos;ll see the same bookings, notes, and progress
            you do.
          </p>

          <form onSubmit={handleInviteStudent} className="flex gap-3 mb-4">
            <input
              type="email"
              value={studentEmailInvite}
              onChange={(e) => setStudentEmailInvite(e.target.value)}
              placeholder="student@email.com"
              required
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={sendingInvite || !studentEmailInvite.trim()}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {sendingInvite ? "Sending..." : "Send Invite"}
            </button>
          </form>

          {familyInvitations.length > 0 && (
            <div className="space-y-2">
              {familyInvitations.map((inv) => {
                const expired =
                  inv.status === "pending" &&
                  new Date(inv.expiresAt) < new Date();
                const label = expired
                  ? "Expired"
                  : inv.status === "accepted"
                  ? "Linked"
                  : "Pending";
                const cls = expired
                  ? "bg-gray-100 text-gray-500 border-gray-200"
                  : inv.status === "accepted"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-yellow-100 text-yellow-700 border-yellow-200";
                return (
                  <div
                    key={inv.token}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <span className="text-gray-700">
                      {inv.invitedStudentEmail}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${cls}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            <Link
              href="/family"
              className="text-primary-600 hover:text-primary-700"
            >
              Open full management page →
            </Link>
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
