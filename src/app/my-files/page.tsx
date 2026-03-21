"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";

interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
}

export default function MyFilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/files/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Files</h1>
          <p className="text-gray-600 mt-1">
            Upload and manage your homework, practice problems, and session
            materials.
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Upload Files
          </h2>
          <FileUpload
            endpoint="/api/files/upload"
            onUploadComplete={fetchFiles}
            maxSizeMB={10}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Your Files
            </h2>
            <button
              onClick={fetchFiles}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Refresh
            </button>
          </div>
          <FileList
            files={files}
            loading={loading}
            allowDelete
            onDelete={fetchFiles}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}
