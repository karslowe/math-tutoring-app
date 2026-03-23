"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignUpForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Referral state
  const [referralToken, setReferralToken] = useState("");
  const [referralValid, setReferralValid] = useState(false);
  const [referrerEmail, setReferrerEmail] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");

  // Check for referral token in URL
  useEffect(() => {
    const token = searchParams.get("referralToken");
    if (token) {
      setReferralToken(token);
      // Validate the token
      fetch(`/api/referrals/validate?token=${token}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setReferralValid(true);
            setReferrerEmail(data.referrerEmail || "");
            setInvitedEmail(data.invitedEmail || "");
            if (data.invitedEmail) {
              setEmail(data.invitedEmail);
            }
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // If referral exists, verify email matches
    if (referralToken && invitedEmail && email.toLowerCase() !== invitedEmail.toLowerCase()) {
      setError("Please sign up with the email the referral was sent to: " + invitedEmail);
      return;
    }

    setLoading(true);
    try {
      await signUp(username, email, password, name);

      // Store referral token for redemption after login
      if (referralToken && referralValid) {
        sessionStorage.setItem("referralToken", referralToken);
      }

      router.push(`/auth/confirm?username=${encodeURIComponent(username)}`);
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Create Account
          </h1>

          {/* Referral Banner */}
          {referralValid && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-purple-800 font-medium">
                🎁 You&apos;ve been referred by {referrerEmail.split("@")[0]}!
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Sign up to get a free session credit.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                  referralValid && invitedEmail ? "bg-gray-50" : ""
                }`}
                required
                readOnly={!!(referralValid && invitedEmail)}
              />
              {referralValid && invitedEmail && (
                <p className="text-xs text-purple-600 mt-1">
                  Email set by referral invite
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">
                At least 8 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
