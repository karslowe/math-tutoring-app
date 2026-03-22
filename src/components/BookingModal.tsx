"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";

interface BookingModalProps {
  slot: string; // ISO datetime
  onConfirm: (subject: string) => Promise<void>;
  onCancel: () => void;
}

export default function BookingModal({
  slot,
  onConfirm,
  onCancel,
}: BookingModalProps) {
  const [subject, setSubject] = useState("KL Math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const date = parseISO(slot);

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm(subject);
    } catch (err: any) {
      setError(err.message || "Failed to book session");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Confirm Booking
        </h2>

        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <div className="text-sm space-y-1">
            <p className="text-gray-700">
              <span className="font-medium">Date:</span>{" "}
              {format(date, "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Time:</span>{" "}
              {format(date, "h:mm a")} – {format(new Date(date.getTime() + 60 * 60 * 1000), "h:mm a")}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Duration:</span> 1 hour
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject (optional)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Algebra, Calculus, Geometry"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Booking..." : "Book Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
