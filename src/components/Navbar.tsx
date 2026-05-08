"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path
      ? "text-primary-600 border-b-2 border-primary-600"
      : "text-gray-600 hover:text-primary-600";

  if (loading) {
    return (
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="h-8 w-40 bg-gray-200 animate-pulse rounded" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link
            href={user ? "/dashboard" : "/"}
            className="text-xl font-bold text-primary-700 tracking-tight"
          >
            KL Math Prep
          </Link>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                {user.groups?.includes("tutors") ? (
                  <Link
                    href="/dashboard"
                    className={`text-sm font-medium pb-0.5 ${isActive("/dashboard")}`}
                  >
                    Dashboard
                  </Link>
                ) : null}
                {user.groups?.includes("tutors") ? (
                  <>
                    <Link
                      href="/tutor/files"
                      className={`text-sm font-medium pb-0.5 ${isActive("/tutor/files")}`}
                    >
                      Student Files
                    </Link>
                    <Link
                      href="/tutor/upload"
                      className={`text-sm font-medium pb-0.5 ${isActive("/tutor/upload")}`}
                    >
                      Upload Notes
                    </Link>
                    <Link
                      href="/tutor/session-notes"
                      className={`text-sm font-medium pb-0.5 ${isActive("/tutor/session-notes")}`}
                    >
                      Session Notes
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/settings"
                    aria-label="Settings"
                    className={`p-2 rounded-full transition-colors ${
                      pathname === "/settings"
                        ? "text-primary-600 bg-primary-50"
                        : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </Link>
                )}
                {user.groups?.includes("tutors") && (
                  <span className="text-sm text-gray-500">{user.email}</span>
                )}
                <button
                  onClick={signOut}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
