"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, getToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [surveyChecked, setSurveyChecked] = useState(false);

  const isStudent = user ? !user.groups?.includes("tutors") : false;
  const onSurveyPage = pathname === "/survey";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || !isStudent || onSurveyPage) {
      setSurveyChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/profile/survey", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setSurveyChecked(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.surveyCompleted) {
          router.push("/survey");
        } else {
          setSurveyChecked(true);
        }
      } catch {
        if (!cancelled) setSurveyChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, isStudent, onSurveyPage, getToken, router]);

  if (loading || !surveyChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
