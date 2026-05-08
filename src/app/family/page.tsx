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

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  accepted: {
    label: "Linked",
    className: "bg-green-100 text-green-700 border-green-200",
  },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export default function FamilyPage() {
  const { getToken } = useAuth();
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchInvitations = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/family/invitations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setSending(true);
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
      setInviteEmail("");
      fetchInvitations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Connect Student Account
            </h1>
            <p className="text-gray-600 mt-1">
              Invite a student so they have their own login linked to your
              account.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Dashboard
          </Link>
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

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">
            How it works
          </h2>
          <ol className="space-y-1.5 text-sm text-blue-800 list-decimal list-inside">
            <li>Enter the student&apos;s email and send the invite.</li>
            <li>
              The student gets an email with a signup link. They create their
              own account.
            </li>
            <li>
              Once they sign up, their account is linked to yours. If they
              already have an account, they can sign in and open the same link
              to connect.
            </li>
          </ol>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Invite a Student
          </h2>
          <form onSubmit={handleSendInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="student@email.com"
              required
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={sending || !inviteEmail.trim()}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending..." : "Send Invite"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Sent Invitations
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4">
                  <div className="h-4 bg-gray-100 rounded w-48" />
                  <div className="h-5 bg-gray-100 rounded w-20" />
                </div>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              No invitations sent yet.
            </p>
          ) : (
            <div className="space-y-3">
              {invitations.map((invite) => {
                const expired =
                  invite.status === "pending" && isExpired(invite.expiresAt);
                const badge = expired
                  ? {
                      label: "Expired",
                      className:
                        "bg-gray-100 text-gray-500 border-gray-200",
                    }
                  : STATUS_BADGES[invite.status];

                return (
                  <div
                    key={invite.token}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {invite.invitedStudentEmail}
                      </p>
                      <p className="text-xs text-gray-500">
                        Sent {formatDate(invite.createdAt)}
                        {invite.status === "pending" && !expired && (
                          <> &middot; Expires {formatDate(invite.expiresAt)}</>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
