"use client";

import { useState, useEffect } from "react";

interface TimeWindow {
  start: string; // HH:MM
  end: string; // HH:MM
}

interface DayAvailability {
  day: string;
  label: string;
  slots: TimeWindow[];
}

const DAYS: { day: string; label: string }[] = [
  { day: "monday", label: "Monday" },
  { day: "tuesday", label: "Tuesday" },
  { day: "wednesday", label: "Wednesday" },
  { day: "thursday", label: "Thursday" },
  { day: "friday", label: "Friday" },
  { day: "saturday", label: "Saturday" },
  { day: "sunday", label: "Sunday" },
];

interface AvailabilityEditorProps {
  getToken: () => Promise<string | null>;
  getIdToken: () => Promise<string | null>;
}

export default function AvailabilityEditor({
  getToken,
  getIdToken,
}: AvailabilityEditorProps) {
  const [schedule, setSchedule] = useState<DayAvailability[]>(
    DAYS.map((d) => ({ ...d, slots: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadAvailability();
  }, []);

  async function loadAvailability() {
    try {
      const token = await getToken();
      const res = await fetch("/api/availability", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.availability) {
        setSchedule((prev) =>
          prev.map((dayEntry) => {
            const saved = data.availability.find(
              (a: any) => a.sk === dayEntry.day
            );
            return saved ? { ...dayEntry, slots: saved.slots } : dayEntry;
          })
        );
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
    } finally {
      setLoading(false);
    }
  }

  function addSlot(dayIndex: number) {
    setSchedule((prev) => {
      const updated = [...prev];
      updated[dayIndex] = {
        ...updated[dayIndex],
        slots: [...updated[dayIndex].slots, { start: "09:00", end: "10:00" }],
      };
      return updated;
    });
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    setSchedule((prev) => {
      const updated = [...prev];
      updated[dayIndex] = {
        ...updated[dayIndex],
        slots: updated[dayIndex].slots.filter((_, i) => i !== slotIndex),
      };
      return updated;
    });
  }

  function updateSlot(
    dayIndex: number,
    slotIndex: number,
    field: "start" | "end",
    value: string
  ) {
    setSchedule((prev) => {
      const updated = [...prev];
      const slots = [...updated[dayIndex].slots];
      slots[slotIndex] = { ...slots[slotIndex], [field]: value };
      updated[dayIndex] = { ...updated[dayIndex], slots };
      return updated;
    });
  }

  async function saveDay(dayIndex: number) {
    const dayEntry = schedule[dayIndex];
    setSaving(dayEntry.day);
    setMessage(null);

    try {
      const token = await getToken();
      const idToken = await getIdToken();

      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
        body: JSON.stringify({
          dayOfWeek: dayEntry.day,
          slots: dayEntry.slots,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: `${dayEntry.label} saved!` });
    } catch (error) {
      setMessage({ type: "error", text: `Failed to save ${dayEntry.label}` });
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {schedule.map((dayEntry, dayIndex) => (
        <div
          key={dayEntry.day}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{dayEntry.label}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => addSlot(dayIndex)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add time window
              </button>
              <button
                onClick={() => saveDay(dayIndex)}
                disabled={saving === dayEntry.day}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving === dayEntry.day ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {dayEntry.slots.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No availability set — day off
            </p>
          ) : (
            <div className="space-y-2">
              {dayEntry.slots.map((slot, slotIndex) => (
                <div
                  key={slotIndex}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) =>
                      updateSlot(dayIndex, slotIndex, "start", e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) =>
                      updateSlot(dayIndex, slotIndex, "end", e.target.value)
                    }
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={() => removeSlot(dayIndex, slotIndex)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
