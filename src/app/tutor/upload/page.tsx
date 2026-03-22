"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FileUpload } from "@/components/FileUpload";
import Link from "next/link";

interface Student {
  sub: string;
  email: string;
  username: string;
}

export default function TutorUploadPage() {
  const { user, getToken, getIdToken } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const isTutor = user?.groups?.includes("tutors");

  useEffect(() => {
    async function fetchStudents() {
      try {
        const token = await getToken();
        const idToken = await getIdToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        if (idToken) {
          headers["x-id-token"] = idToken;
        }

        const res = await fetch("/api/tutor/students", { headers });
        if (!res.ok) throw new Error("Failed to load students");
        const data = await res.json();
        setStudents(data.students);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingStudents(false);
      }
    }

    if (isTutor) {
      fetchStudents();
    } else {
      setLoadingStudents(false);
    }
  }, [isTutor, getToken, getIdToken]);

  if (!isTutor) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Tutor Access Required
            </h2>
            <p className="text-red-600 text-sm">
              This page is only accessible to tutors.
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const selectedStudentInfo = students.find((s) => s.sub === selectedStudent);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Upload Completed Notes
          </h1>
          <p className="text-gray-600 mt-1">
            Select a student and upload session notes or completed materials for
            them to access.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
            {uploadSuccess}
          </div>
        )}

        {/* Student Selector */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Student
          </label>
          {loadingStudents ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : students.length === 0 ? (
            <p className="text-sm text-gray-500">
              No students found. Students need to sign up first.
            </p>
          ) : (
            <select
              value={selectedStudent}
              onChange={(e) => {
                setSelectedStudent(e.target.value);
                setUploadSuccess("");
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
            >
              <option value="">-- Choose a student --</option>
              {students.map((s) => (
                <option key={s.sub} value={s.sub}>
                  {s.email} ({s.username})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Upload Area */}
        {selectedStudent && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <h2 className="text-sm font-medium text-gray-700">
                  Uploading for:{" "}
                  <span className="text-gray-900">
                    {selectedStudentInfo?.email}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-gray-500">
                Files will appear on this student&apos;s Completed Notes page.
              </p>
            </div>

            <FileUpload
              endpoint="/api/tutor/upload"
              extraFormData={{ studentSub: selectedStudent }}
              useIdToken={true}
              maxSizeMB={50}
              onUploadComplete={() => {
                setUploadSuccess(
                  `Notes uploaded successfully for ${selectedStudentInfo?.email}!`
                );
              }}
            />
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
