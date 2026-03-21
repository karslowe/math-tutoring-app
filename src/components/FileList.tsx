"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  downloadUrl: string;
}

interface FileListProps {
  files: FileItem[];
  loading: boolean;
  allowDelete?: boolean;
  onDelete?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx"].includes(ext)) return "sheet";
  if (["ppt", "pptx"].includes(ext)) return "slide";
  return "file";
}

function FileIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-500",
    image: "text-green-500",
    doc: "text-blue-500",
    sheet: "text-emerald-500",
    slide: "text-orange-500",
    file: "text-gray-400",
  };

  return (
    <svg
      className={`w-8 h-8 ${colors[type] || colors.file}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function FileList({
  files,
  loading,
  allowDelete = false,
  onDelete,
}: FileListProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const { getToken } = useAuth();

  async function handleDelete(key: string) {
    if (!confirm("Are you sure you want to delete this file?")) return;

    setDeletingKey(key);
    try {
      const token = await getToken();
      const response = await fetch("/api/files/delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      onDelete?.();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <svg
          className="mx-auto h-12 w-12 text-gray-300 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-gray-500 text-sm">No files yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.key}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileIcon type={getFileIcon(file.name)} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)} &middot;{" "}
                {formatDate(file.lastModified)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={file.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Download
              </a>

              {allowDelete && (
                <button
                  onClick={() => handleDelete(file.key)}
                  disabled={deletingKey === file.key}
                  className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingKey === file.key ? "..." : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
