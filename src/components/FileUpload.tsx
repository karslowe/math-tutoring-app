"use client";

import { useState, useRef, DragEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface FileUploadProps {
  endpoint: string;
  extraFormData?: Record<string, string>;
  onUploadComplete?: () => void;
  maxSizeMB?: number;
  useIdToken?: boolean;
}

export function FileUpload({
  endpoint,
  extraFormData,
  onUploadComplete,
  maxSizeMB = 10,
  useIdToken = false,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getToken, getIdToken } = useAuth();

  async function uploadFiles(files: FileList | File[]) {
    setError("");
    setUploading(true);

    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProgress(`Uploading ${file.name} (${i + 1}/${fileArray.length})...`);

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`${file.name} is too large. Maximum size is ${maxSizeMB}MB.`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      if (extraFormData) {
        Object.entries(extraFormData).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      try {
        const token = await getToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        if (useIdToken) {
          const idToken = await getIdToken();
          if (idToken) {
            headers["x-id-token"] = idToken;
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }
      } catch (err: any) {
        setError(err.message || "Failed to upload file");
      }
    }

    setUploading(false);
    setProgress("");
    onUploadComplete?.();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-primary-500 bg-primary-50"
            : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <svg
          className="mx-auto h-10 w-10 text-gray-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        {uploading ? (
          <div>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{progress}</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-700">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Maximum file size: {maxSizeMB}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
