"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, user, getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Referral state
  const [referralToken, setReferralToken] = useState("");
  const [referralValid, setReferralValid] = useState(false);
  const [referrerEmail, setReferrerEmail] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");

  // Family invite state
  const [familyToken, setFamilyToken] = useState("");
  const [familyValid, setFamilyValid] = useState(false);
  const [parentEmail, setParentEmail] = useState("");

  useEffect(() => {
    const refToken = searchParams.get("referralToken");
    if (refToken) {
      setReferralToken(refToken);
      fetch(`/api/referrals/validate?token=${refToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setReferralValid(true);
            setReferrerEmail(data.referrerEmail || "");
            setInvitedEmail(data.invitedEmail || "");
            if (data.invitedEmail) setEmail(data.invitedEmail);
          }
        })
        .catch(() => {});
    }

    const famToken = searchParams.get("familyToken");
    if (famToken) {
      setFamilyToken(famToken);
      fetch(`/api/family/invitations/validate?token=${famToken}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setFamilyValid(true);
            setParentEmail(data.parentEmail || "");
            if (data.invitedStudentEmail) setEmail(data.invitedStudentEmail);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // If a logged-in user lands here with a family invite token, redeem it
  // directly instead of trying to sign up again.
  useEffect(() => {
    const famToken = searchParams.get("familyToken");
    if (!famToken || !user) return;
    (async () => {
      try {
        const tok = await getToken();
        const res = await fetch("/api/family/invitations/redeem", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: famToken }),
        });
        if (res.ok) {
          sessionStorage.removeItem("familyInviteToken");
          router.push("/dashboard");
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Could not redeem this invitation.");
        }
      } catch {
        setError("Could not redeem this invitation.");
      }
    })();
  }, [searchParams, user, getToken, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (referralToken && invitedEmail && email.toLowerCase() !== invitedEmail.toLowerCase()) {
      setError("Please sign up with the email the referral was sent to: " + invitedEmail);
      return;
    }

    let normalizedPhone = "";
    if (phone.trim()) {
      normalizedPhone = normalizePhone(phone);
      if (!/^\+\d{8,15}$/.test(normalizedPhone)) {
        setError(
          "Phone number must be in international format (e.g. +14155550123)."
        );
        return;
      }
    }

    setLoading(true);
    try {
      await signUp(email, password, name);

      if (referralToken && referralValid) {
        sessionStorage.setItem("referralToken", referralToken);
      }
      if (familyToken && familyValid) {
        sessionStorage.setItem("familyInviteToken", familyToken);
      }
      if (normalizedPhone) {
        sessionStorage.setItem("pendingPhone", normalizedPhone);
      }

      router.push(`/auth/confirm?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 rounded-2xl border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center tracking-tight">
            Create Account
          </h1>

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

          {familyValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-blue-800 font-medium">
                Your account will be linked to {parentEmail}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                You&apos;ll have your own login; your parent will stay connected to your sessions.
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
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
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
                className={`w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 ${
                  (referralValid && invitedEmail) || (familyValid && email) ? "bg-gray-50" : ""
                }`}
                required
                readOnly={!!(referralValid && invitedEmail) || !!(familyValid && email)}
              />
              {referralValid && invitedEmail && (
                <p className="text-xs text-purple-600 mt-1">
                  Email set by referral invite
                </p>
              )}
              {familyValid && email && !referralValid && (
                <p className="text-xs text-blue-600 mt-1">
                  Email set by parent invite
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(415) 555-0123"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                autoComplete="tel"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used to reach you if email isn&apos;t working.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
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
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-full font-medium hover:bg-primary-700 hover:shadow-md disabled:opacity-50 transition-all"
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
