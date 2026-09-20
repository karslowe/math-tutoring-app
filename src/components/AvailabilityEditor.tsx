"use client";

import { useState, useEffect } from "react";
import TimeRangeInput from "./TimeRangeInput";
import { withTutorSub } from "@/lib/tutor-query";

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
  // Under the shared-login model (ADR-0009), which tutor's hours this edits.
  // Omit to act as the caller's own account.
  actingAsTutorSub?: string;
}

export default function AvailabilityEditor({
  getToken,
  getIdToken,
  actingAsTutorSub,
}: AvailabilityEditorProps) {
  const [schedule, setSchedule] = useState<DayAvailability[]>(
    DAYS.map((d) => ({ ...d, slots: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyDays, setDirtyDays] = useState<Set<string>>(new Set());
  const [copyOpenFor, setCopyOpenFor] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(withTutorSub("/api/availability", actingAsTutorSub), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        setSchedule(
          DAYS.map((d) => {
            const saved = (data.availability || []).find((a: any) => a.sk === d.day);
            return { ...d, slots: saved ? saved.slots : [] };
          })
        );
        setDirtyDays(new Set());
      } catch (error) {
        console.error("Failed to load availability:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAvailability();
  }, [getToken, actingAsTutorSub]);

  function markDirty(day: string) {
    setDirtyDays((prev) => new Set(prev).add(day));
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
    markDirty(schedule[dayIndex].day);
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
    markDirty(schedule[dayIndex].day);
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
    markDirty(schedule[dayIndex].day);
  }

  function openCopy(day: string) {
    setCopyOpenFor(day);
    setCopyTargets(new Set());
  }

  function toggleCopyTarget(day: string) {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function applyCopy(sourceDay: string) {
    const source = schedule.find((d) => d.day === sourceDay);
    if (!source) return;
    setSchedule((prev) =>
      prev.map((d) =>
        copyTargets.has(d.day) ? { ...d, slots: source.slots.map((s) => ({ ...s })) } : d
      )
    );
    setDirtyDays((prev) => {
      const next = new Set(prev);
      copyTargets.forEach((d) => next.add(d));
      return next;
    });
    setCopyOpenFor(null);
    setCopyTargets(new Set());
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    try {
      const token = await getToken();
      const idToken = await getIdToken();
      const daysToSave = schedule.filter((d) => dirtyDays.has(d.day));

      const results = await Promise.all(
        daysToSave.map((d) =>
          fetch(withTutorSub("/api/availability", actingAsTutorSub), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(idToken ? { "x-id-token": idToken } : {}),
            },
            body: JSON.stringify({ dayOfWeek: d.day, slots: d.slots }),
          })
        )
      );

      if (results.some((r) => !r.ok)) throw new Error("Some days failed to save");
      setDirtyDays(new Set());
      setMessage({ type: "success", text: "Saved!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save changes" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {dirtyDays.size > 0
            ? `${dirtyDays.size} day${dirtyDays.size === 1 ? "" : "s"} with unsaved changes`
            : "All changes saved"}
        </p>
        <button
          onClick={saveAll}
          disabled={saving || dirtyDays.size === 0}
          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save all changes"}
        </button>
      </div>

      {message && (
        <div
          className={`p-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
        {schedule.map((dayEntry, dayIndex) => (
          <div key={dayEntry.day} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="w-24 shrink-0 pt-1.5">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {dayEntry.label}
                  {dirtyDays.has(dayEntry.day) && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" />
                  )}
                </h3>
              </div>

              <div className="flex-1 min-w-0">
                {dayEntry.slots.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-1.5">Day off</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEntry.slots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="flex items-center gap-2">
                        <TimeRangeInput
                          start={slot.start}
                          end={slot.end}
                          onChangeStart={(v) => updateSlot(dayIndex, slotIndex, "start", v)}
                          onChangeEnd={(v) => updateSlot(dayIndex, slotIndex, "end", v)}
                        />
                        <button
                          onClick={() => removeSlot(dayIndex, slotIndex)}
                          className="text-red-500 hover:text-red-700 p-1"
                          aria-label="Remove time window"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {copyOpenFor === dayEntry.day && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
                    <span className="text-xs text-gray-500">Copy to:</span>
                    {DAYS.filter((d) => d.day !== dayEntry.day).map((d) => (
                      <label key={d.day} className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={copyTargets.has(d.day)}
                          onChange={() => toggleCopyTarget(d.day)}
                        />
                        {d.label.slice(0, 3)}
                      </label>
                    ))}
                    <button
                      onClick={() => applyCopy(dayEntry.day)}
                      disabled={copyTargets.size === 0}
                      className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-40"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setCopyOpenFor(null)}
                      className="text-xs text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => addSlot(dayIndex)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  + Add window
                </button>
                {dayEntry.slots.length > 0 && (
                  <button
                    onClick={() => openCopy(dayEntry.day)}
                    className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
                  >
                    Copy to...
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
