"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import TimeRangeInput from "./TimeRangeInput";
import { withTutorSub } from "@/lib/tutor-query";

interface TimeRange {
  start: string;
  end: string;
}

interface DayBlocks {
  date: string; // YYYY-MM-DD
  label: string;
  baseSlots: TimeRange[];
  blockedRanges: TimeRange[];
}

interface WeeklyBlocksEditorProps {
  getToken: () => Promise<string | null>;
  getIdToken: () => Promise<string | null>;
  // Under the shared-login model (ADR-0009), which tutor's blocks this edits.
  // Omit to act as the caller's own account.
  actingAsTutorSub?: string;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export default function WeeklyBlocksEditor({
  getToken,
  getIdToken,
  actingAsTutorSub,
}: WeeklyBlocksEditorProps) {
  const [days, setDays] = useState<DayBlocks[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const today = new Date();
      const nextTwoWeeks: Date[] = [];
      for (let i = 0; i < 14; i++) {
        nextTwoWeeks.push(addDays(today, i));
      }

      const startStr = format(nextTwoWeeks[0], "yyyy-MM-dd");
      const endStr = format(nextTwoWeeks[13], "yyyy-MM-dd");

      const [weeklyRes, overridesRes] = await Promise.all([
        fetch(withTutorSub("/api/availability", actingAsTutorSub), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          withTutorSub(
            `/api/availability/overrides?startDate=${startStr}&endDate=${endStr}`,
            actingAsTutorSub
          ),
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);

      const weeklyData = await weeklyRes.json();
      const overridesData = await overridesRes.json();

      const weekly: Record<string, TimeRange[]> = {};
      for (const day of weeklyData.availability || []) {
        weekly[day.sk] = day.slots || [];
      }

      const overridesByDate: Record<string, TimeRange[]> = {};
      for (const o of overridesData.overrides || []) {
        overridesByDate[o.sk] = o.blockedRanges || [];
      }

      const computed: DayBlocks[] = nextTwoWeeks.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const dayName = DAY_NAMES[d.getDay()];
        return {
          date: dateStr,
          label: format(d, "EEE, MMM d"),
          baseSlots: weekly[dayName] || [],
          blockedRanges: overridesByDate[dateStr] || [],
        };
      });

      setDays(computed);
    } catch (error) {
      console.error("Failed to load blocks:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken, actingAsTutorSub]);

  useEffect(() => {
    load();
  }, [load]);

  function addBlock(dateIndex: number) {
    setDays((prev) => {
      const updated = [...prev];
      updated[dateIndex] = {
        ...updated[dateIndex],
        blockedRanges: [
          ...updated[dateIndex].blockedRanges,
          { start: "09:00", end: "10:00" },
        ],
      };
      return updated;
    });
  }

  function updateBlock(
    dateIndex: number,
    blockIndex: number,
    field: "start" | "end",
    value: string
  ) {
    setDays((prev) => {
      const updated = [...prev];
      const ranges = [...updated[dateIndex].blockedRanges];
      ranges[blockIndex] = { ...ranges[blockIndex], [field]: value };
      updated[dateIndex] = { ...updated[dateIndex], blockedRanges: ranges };
      return updated;
    });
  }

  function removeBlock(dateIndex: number, blockIndex: number) {
    setDays((prev) => {
      const updated = [...prev];
      updated[dateIndex] = {
        ...updated[dateIndex],
        blockedRanges: updated[dateIndex].blockedRanges.filter(
          (_, i) => i !== blockIndex
        ),
      };
      return updated;
    });
  }

  function blockEntireDay(dateIndex: number) {
    setDays((prev) => {
      const updated = [...prev];
      updated[dateIndex] = {
        ...updated[dateIndex],
        blockedRanges: [{ start: "00:00", end: "23:59" }],
      };
      return updated;
    });
  }

  async function saveDay(dateIndex: number) {
    const day = days[dateIndex];
    setSavingDate(day.date);
    setMessage(null);
    try {
      const token = await getToken();
      const idToken = await getIdToken();

      const res = await fetch(withTutorSub("/api/availability/overrides", actingAsTutorSub), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(idToken ? { "x-id-token": idToken } : {}),
        },
        body: JSON.stringify({
          date: day.date,
          blockedRanges: day.blockedRanges,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage({ type: "success", text: `${day.label} saved!` });
    } catch (error) {
      setMessage({ type: "error", text: `Failed to save ${day.label}` });
    } finally {
      setSavingDate(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function clearDay(dateIndex: number) {
    const day = days[dateIndex];
    setSavingDate(day.date);
    try {
      const token = await getToken();
      const idToken = await getIdToken();

      await fetch(
        withTutorSub(`/api/availability/overrides?date=${day.date}`, actingAsTutorSub),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(idToken ? { "x-id-token": idToken } : {}),
          },
        }
      );

      setDays((prev) => {
        const updated = [...prev];
        updated[dateIndex] = { ...updated[dateIndex], blockedRanges: [] };
        return updated;
      });
      setMessage({ type: "success", text: `${day.label} unblocked` });
    } catch {
      setMessage({ type: "error", text: "Failed to clear blocks" });
    } finally {
      setSavingDate(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(14)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-10" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-800">
          <strong>Heads up:</strong> All blocks reset every other Sunday at
          10am PT. You&apos;ll get an email reminder to re-block for the upcoming
          2 weeks.
        </p>
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
        {days.map((day, dayIndex) => (
          <div key={day.date} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="w-28 shrink-0 pt-1">
                <h3 className="font-semibold text-gray-900 text-sm">{day.label}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {day.baseSlots.length === 0
                    ? "Off"
                    : day.baseSlots.map((s) => `${s.start}–${s.end}`).join(", ")}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                {day.blockedRanges.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-1">No blocks</p>
                ) : (
                  <div className="space-y-1.5">
                    {day.blockedRanges.map((range, blockIndex) => (
                      <div
                        key={blockIndex}
                        className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5"
                      >
                        <span className="text-red-700 font-medium text-[11px]">BLOCKED</span>
                        <TimeRangeInput
                          start={range.start}
                          end={range.end}
                          onChangeStart={(v) => updateBlock(dayIndex, blockIndex, "start", v)}
                          onChangeEnd={(v) => updateBlock(dayIndex, blockIndex, "end", v)}
                        />
                        <button
                          onClick={() => removeBlock(dayIndex, blockIndex)}
                          className="text-red-500 hover:text-red-700 p-1 ml-auto"
                          aria-label="Remove block"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addBlock(dayIndex)}
                    disabled={day.baseSlots.length === 0}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    + Block range
                  </button>
                  <button
                    onClick={() => blockEntireDay(dayIndex)}
                    disabled={day.baseSlots.length === 0}
                    className="text-xs text-red-600 hover:text-red-700 font-medium disabled:text-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Block all day
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {day.blockedRanges.length > 0 && (
                    <button
                      onClick={() => clearDay(dayIndex)}
                      disabled={savingDate === day.date}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => saveDay(dayIndex)}
                    disabled={savingDate === day.date}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingDate === day.date ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
