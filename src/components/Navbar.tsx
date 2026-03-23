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
            href="/"
            className="text-xl font-bold text-primary-700 tracking-tight"
          >
            KL Math Prep
          </Link>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`text-sm font-medium pb-0.5 ${isActive("/dashboard")}`}
                >
                  Dashboard
                </Link>
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
                  <>
                    <Link
                      href="/my-files"
                      className={`text-sm font-medium pb-0.5 ${isActive("/my-files")}`}
                    >
                      My Files
                    </Link>
                    <Link
                      href="/completed-notes"
                      className={`text-sm font-medium pb-0.5 ${isActive("/completed-notes")}`}
                    >
                      Completed Notes
                    </Link>
                    <Link
                      href="/session-history"
                      className={`text-sm font-medium pb-0.5 ${isActive("/session-history")}`}
                    >
                      Session History
                    </Link>
                    <Link
                      href="/settings"
                      className={`text-sm font-medium pb-0.5 ${isActive("/settings")}`}
                    >
                      Settings
                    </Link>
                  </>
                )}
                <span className="text-sm text-gray-500">
                  {user.email}
                </span>
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
