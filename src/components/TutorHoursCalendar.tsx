"use client";

import { useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { withTutorSub } from "@/lib/tutor-query";
import { to12Hour } from "@/lib/time-format";
import { getEffectiveWindowsForDate } from "@/lib/availability-windows";
import type { WeeklyAvailability, DateOverride } from "@/lib/dynamodb";

interface TimeWindow {
  start: string; // HH:MM
  end: string; // HH:MM
}

// Same default as the rest of the app (see .env.local.example) — public so
// it's available client-side for the "now" line and day-of-week math.
const TUTOR_TIMEZONE = process.env.NEXT_PUBLIC_TUTOR_TIMEZONE || "America/Los_Angeles";
const DAYS_AHEAD = 7;

// Validated red/blue categorical pair (dataviz skill) — passes CVD-separation
// and normal-vision-floor checks as a two-series palette on a white surface.
const FOUNDER_COLOR = "#e34948";
const SECOND_COLOR = "#2a78d6";
const NOW_LINE_COLOR = "#0b0b0b";

const BAR_HEIGHT = 18;
const BAR_GAP = 3;
const TRACK_HEIGHT = BAR_HEIGHT * 2 + BAR_GAP;

interface TutorHoursCalendarProps {
  getToken: () => Promise<string | null>;
  founderName: string;
  secondTutorName: string;
  secondTutorSub: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hourLabel(hour: number): string {
  const { hour: h, meridiem } = to12Hour(`${String(hour % 24).padStart(2, "0")}:00`);
  return `${h} ${meridiem}`;
}

function rangeLabel(slot: TimeWindow): string {
  const s = to12Hour(slot.start);
  const e = to12Hour(slot.end);
  return `${s.hour}:${String(s.minute).padStart(2, "0")} ${s.meridiem} – ${e.hour}:${String(e.minute).padStart(2, "0")} ${e.meridiem}`;
}

export default function TutorHoursCalendar({
  getToken,
  founderName,
  secondTutorName,
  secondTutorSub,
}: TutorHoursCalendarProps) {
  const [founderWeekly, setFounderWeekly] = useState<WeeklyAvailability[]>([]);
  const [secondWeekly, setSecondWeekly] = useState<WeeklyAvailability[]>([]);
  const [founderOverrides, setFounderOverrides] = useState<DateOverride[]>([]);
  const [secondOverrides, setSecondOverrides] = useState<DateOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Anchored to "now" in the tutor's timezone, not the viewer's — the same
  // anchor is reused below for the live "now" line, so the two can't drift.
  const zonedNow = toZonedTime(new Date(), TUTOR_TIMEZONE);
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(zonedNow, i));
  const startStr = format(dates[0], "yyyy-MM-dd");
  const endStr = format(dates[dates.length - 1], "yyyy-MM-dd");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const overridesQs = `startDate=${startStr}&endDate=${endStr}`;

        const [founderWeeklyRes, secondWeeklyRes, founderOverridesRes, secondOverridesRes] =
          await Promise.all([
            fetch("/api/availability", { headers }),
            fetch(withTutorSub("/api/availability", secondTutorSub), { headers }),
            fetch(`/api/availability/overrides?${overridesQs}`, { headers }),
            fetch(withTutorSub(`/api/availability/overrides?${overridesQs}`, secondTutorSub), {
              headers,
            }),
          ]);

        setFounderWeekly((await founderWeeklyRes.json()).availability || []);
        setSecondWeekly((await secondWeeklyRes.json()).availability || []);
        setFounderOverrides((await founderOverridesRes.json()).overrides || []);
        setSecondOverrides((await secondOverridesRes.json()).overrides || []);
      } catch (error) {
        console.error("Failed to load hours calendar:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
    // startStr/endStr are derived from the render-time "now" anchor, which is
    // intentionally not a dependency — this should refetch on token/tutor
    // changes, not re-run every render as the clock ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, secondTutorSub]);

  if (loading) {
    return <div className="animate-pulse bg-gray-100 rounded-xl h-64" />;
  }

  const dateStrs = dates.map((d) => format(d, "yyyy-MM-dd"));
  const founderByDate = dates.map((d, i) =>
    getEffectiveWindowsForDate(d, dateStrs[i], founderWeekly, founderOverrides)
  );
  const secondByDate = dates.map((d, i) =>
    getEffectiveWindowsForDate(d, dateStrs[i], secondWeekly, secondOverrides)
  );

  const allSlots = [...founderByDate, ...secondByDate].flat();
  const rangeStart = allSlots.length
    ? Math.floor(Math.min(...allSlots.map((s) => toMinutes(s.start))) / 60) * 60
    : 8 * 60;
  const rangeEnd = allSlots.length
    ? Math.ceil(Math.max(...allSlots.map((s) => toMinutes(s.end))) / 60) * 60
    : 20 * 60;
  const rangeSpan = Math.max(rangeEnd - rangeStart, 60);

  const tickStepHours = rangeSpan / 60 > 10 ? 3 : 2;
  const ticks: number[] = [];
  for (let h = Math.ceil(rangeStart / 60); h * 60 <= rangeEnd; h += tickStepHours) {
    ticks.push(h);
  }

  const nowMinutes = zonedNow.getHours() * 60 + zonedNow.getMinutes();
  const nowPercent = ((nowMinutes - rangeStart) / rangeSpan) * 100;
  const nowVisible = nowMinutes >= rangeStart && nowMinutes <= rangeEnd;

  function barStyle(slot: TimeWindow, top: number, color: string) {
    const left = ((toMinutes(slot.start) - rangeStart) / rangeSpan) * 100;
    const width = ((toMinutes(slot.end) - toMinutes(slot.start)) / rangeSpan) * 100;
    return {
      position: "absolute" as const,
      left: `${left}%`,
      width: `${width}%`,
      top,
      height: BAR_HEIGHT,
      backgroundColor: color,
      borderRadius: 4,
    };
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: FOUNDER_COLOR }}
          />
          <span className="text-xs text-gray-700">{founderName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: SECOND_COLOR }}
          />
          <span className="text-xs text-gray-700">{secondTutorName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-px border-t border-dashed border-gray-900" />
          <span className="text-xs text-gray-700">Now</span>
        </div>
      </div>

      {/* Hour axis */}
      <div className="flex mb-1">
        <div className="w-14 shrink-0" />
        <div className="relative flex-1 h-4">
          {ticks.map((h) => (
            <span
              key={h}
              className="absolute text-[10px] text-gray-400 -translate-x-1/2"
              style={{ left: `${((h * 60 - rangeStart) / rangeSpan) * 100}%` }}
            >
              {hourLabel(h)}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {dates.map((date, dayIndex) => {
          const isToday = dayIndex === 0;
          const dateStr = dateStrs[dayIndex];
          return (
            <div key={dateStr} className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <div
                  className={`text-xs font-medium ${isToday ? "text-gray-900" : "text-gray-500"}`}
                >
                  {format(date, "EEE M/d")}
                </div>
                {isToday && (
                  <div className="text-[10px] font-semibold text-blue-600">Today</div>
                )}
              </div>
              <div
                className={`relative flex-1 rounded-md ${
                  isToday ? "bg-blue-50/60 ring-1 ring-blue-200" : "bg-gray-50"
                }`}
                style={{ height: TRACK_HEIGHT }}
              >
                {ticks.map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 w-px bg-gray-200"
                    style={{ left: `${((h * 60 - rangeStart) / rangeSpan) * 100}%` }}
                  />
                ))}
                {founderByDate[dayIndex].map((slot, i) => (
                  <div
                    key={`f-${i}`}
                    style={barStyle(slot, 0, FOUNDER_COLOR)}
                    title={`${founderName}: ${rangeLabel(slot)}`}
                  />
                ))}
                {secondByDate[dayIndex].map((slot, i) => (
                  <div
                    key={`s-${i}`}
                    style={barStyle(slot, BAR_HEIGHT + BAR_GAP, SECOND_COLOR)}
                    title={`${secondTutorName}: ${rangeLabel(slot)}`}
                  />
                ))}
                {isToday && nowVisible && (
                  <div
                    className="absolute top-0 bottom-0 w-0 border-l border-dashed"
                    style={{ left: `${nowPercent}%`, borderColor: NOW_LINE_COLOR }}
                    title={`Now: ${format(zonedNow, "h:mm a")}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
