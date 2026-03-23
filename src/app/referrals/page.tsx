"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";

interface Referral {
  token: string;
  invitedEmail: string;
  status: "pending" | "signed_up" | "credit_awarded";
  createdAt: string;
  expiresAt: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  signed_up: {
    label: "Signed Up",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  credit_awarded: {
    label: "Credit Earned",
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

export default function ReferralsPage() {
  const { getToken } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [maxReferrals, setMaxReferrals] = useState(5);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendingToken, setResendingToken] = useState("");

  const fetchReferrals = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/referrals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReferrals(data.referrals || []);
        setMaxReferrals(data.maxReferrals || 5);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  async function handleResend(referralToken: string) {
    setResendingToken(referralToken);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      const res = await fetch("/api/referrals/resend", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: referralToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend");
      }

      setSuccess("Invite resent!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendingToken("");
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitedEmail: email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send invite");
      }

      setSuccess(`Invite sent to ${email}!`);
      setInviteEmail("");
      fetchReferrals();
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
              Refer a Friend
            </h1>
            <p className="text-gray-600 mt-1">
              Invite friends to KL Math Prep. You both get a free session!
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

        {/* How it works */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-purple-800 mb-3">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </span>
              <p className="text-sm text-purple-700">
                Enter your friend&apos;s email and send the invite
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </span>
              <p className="text-sm text-purple-700">
                They sign up and get a free session credit
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </span>
              <p className="text-sm text-purple-700">
                After their first session, you get a free credit too!
              </p>
            </div>
          </div>
        </div>

        {/* Invite Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Invite a Friend
          </h2>
          <div className="text-sm text-gray-500 mb-4">
            {referrals.length} of {maxReferrals} referrals used
          </div>
          {referrals.length >= maxReferrals ? (
            <p className="text-sm text-gray-500">
              You&apos;ve used all your referrals. Thanks for spreading the word!
            </p>
          ) : (
            <form onSubmit={handleSendInvite} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@email.com"
                required
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={sending || !inviteEmail.trim()}
                className="bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send Invite"}
              </button>
            </form>
          )}
        </div>

        {/* Sent Referrals */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Referrals
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
          ) : referrals.length === 0 ? (
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="text-gray-500 text-sm">
                No referrals yet. Invite a friend to get started!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => {
                const expired =
                  referral.status === "pending" && isExpired(referral.expiresAt);
                const badge = expired
                  ? { label: "Expired", className: "bg-gray-100 text-gray-500 border-gray-200" }
                  : STATUS_BADGES[referral.status];

                return (
                  <div
                    key={referral.token}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {referral.invitedEmail}
                      </p>
                      <p className="text-xs text-gray-500">
                        Sent {formatDate(referral.createdAt)}
                        {referral.status === "pending" && !expired && (
                          <> &middot; Expires {formatDate(referral.expiresAt)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {referral.status === "pending" && !expired && (
                        <button
                          onClick={() => handleResend(referral.token)}
                          disabled={resendingToken === referral.token}
                          className="text-xs font-medium text-purple-600 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50 transition-colors disabled:opacity-50"
                        >
                          {resendingToken === referral.token ? "Sending..." : "Resend"}
                        </button>
                      )}
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
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
