"use client";

import { useState, FormEvent, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

function ConfirmForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(
    searchParams.get("email") || searchParams.get("username") || ""
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { confirmSignUp } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await confirmSignUp(email.trim().toLowerCase(), code);
      router.push("/auth/signin");
    } catch (err: any) {
      setError(err.message || "Failed to confirm");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 rounded-2xl border border-gray-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center tracking-tight">
            Confirm Your Account
          </h1>
          <p className="text-sm text-gray-600 mb-6 text-center">
            Check your email for a verification code
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                placeholder="123456"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-full font-medium hover:bg-primary-700 hover:shadow-md disabled:opacity-50 transition-all"
            >
              {loading ? "Confirming..." : "Confirm Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <ConfirmForm />
    </Suspense>
  );
}
