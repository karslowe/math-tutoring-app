"use client";

import { useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { withTutorSub } from "@/lib/tutor-query";
import { to12Hour } from "@/lib/time-format";
import { getEffectiveWindowsForDate } from "@/lib/availability-windows";
import { busyIntervalsForDate, type BusyInterval } from "@/lib/slots";
import type { WeeklyAvailability, DateOverride } from "@/lib/dynamodb";

interface TimeWindow {
  start: string; // HH:MM
  end: string; // HH:MM
}

interface BookedSessionLite {
  id: string;
  tutorSub: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  scheduledAt: string; // ISO instant
  duration: number; // minutes
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
const PERSONAL_BUSY_COLOR = "#6b7280"; // neutral gray — not a tutoring color

// Open availability windows render at this opacity; booked sessions render
// solid on top of them, so "how much of this window is actually filled" is
// readable at a glance without a separate legend entry per state.
const OPEN_OPACITY = 0.22;

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
  const [sessions, setSessions] = useState<BookedSessionLite[]>([]);
  const [founderBusy, setFounderBusy] = useState<BusyInterval[] | null>([]);
  const [busyCheckFailed, setBusyCheckFailed] = useState(false);
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

        const [
          founderWeeklyRes,
          secondWeeklyRes,
          founderOverridesRes,
          secondOverridesRes,
          sessionsRes,
          founderBusyRes,
        ] = await Promise.all([
          fetch("/api/availability", { headers }),
          fetch(withTutorSub("/api/availability", secondTutorSub), { headers }),
          fetch(`/api/availability/overrides?${overridesQs}`, { headers }),
          fetch(withTutorSub(`/api/availability/overrides?${overridesQs}`, secondTutorSub), {
            headers,
          }),
          fetch(`/api/tutor/bookings?startDate=${startStr}&endDate=${endStr}`, { headers }),
          fetch(`/api/tutor/founder-busy?startDate=${startStr}&endDate=${endStr}`, { headers }),
        ]);

        setFounderWeekly((await founderWeeklyRes.json()).availability || []);
        setSecondWeekly((await secondWeeklyRes.json()).availability || []);
        setFounderOverrides((await founderOverridesRes.json()).overrides || []);
        setSecondOverrides((await secondOverridesRes.json()).overrides || []);
        setSessions((await sessionsRes.json()).sessions || []);

        // A non-2xx (e.g. an expired token, a 500) isn't "genuinely free" —
        // treat it the same as the route's own null (check failed) rather
        // than trying to read `.busy` off an error body and getting
        // `undefined`, which would otherwise render as a silently clean
        // calendar instead of surfacing the failure.
        const busy = founderBusyRes.ok ? (await founderBusyRes.json()).busy : null;
        setFounderBusy(busy);
        setBusyCheckFailed(busy === null);
      } catch (error) {
        console.error("Failed to load hours calendar:", error);
        // Any failure in the chain above (network blip, bad JSON, etc.)
        // must not leave the personal-calendar check looking clean by
        // default — the whole point of this flag is to never render an
        // unverified "no conflicts" state as if it were a checked one.
        setFounderBusy(null);
        setBusyCheckFailed(true);
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

  function zonedDateStr(iso: string): string {
    return format(toZonedTime(new Date(iso), TUTOR_TIMEZONE), "yyyy-MM-dd");
  }

  const sessionsByDate: BookedSessionLite[][] = dateStrs.map((dateStr) =>
    sessions.filter((s) => zonedDateStr(s.scheduledAt) === dateStr)
  );
  const founderSessionsByDate = sessionsByDate.map((day) =>
    day.filter((s) => s.tutorSub !== secondTutorSub)
  );
  const secondSessionsByDate = sessionsByDate.map((day) =>
    day.filter((s) => s.tutorSub === secondTutorSub)
  );

  // Clamped per-day against local midnight boundaries (shared with the
  // server-side availability subtraction) — a multi-day or overnight busy
  // block contributes a clipped window to every day it actually touches,
  // rather than being dropped or attributed only to its start day.
  const founderBusyByDate: TimeWindow[][] = dateStrs.map((dateStr) =>
    busyIntervalsForDate(dateStr, founderBusy || [], TUTOR_TIMEZONE)
  );

  function sessionWindow(s: BookedSessionLite): TimeWindow {
    const zoned = toZonedTime(new Date(s.scheduledAt), TUTOR_TIMEZONE);
    const startMin = zoned.getHours() * 60 + zoned.getMinutes();
    // Clip at midnight rather than wrapping — a session literally crossing
    // midnight is a data anomaly this single-day-row view can't span, and
    // wrapping produced a negative-width (invisible) bar instead.
    const endMin = Math.min(startMin + s.duration, 24 * 60);
    return {
      start: `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`,
      end:
        endMin === 24 * 60
          ? "24:00"
          : `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
    };
  }

  const allSlots = [
    ...founderByDate,
    ...secondByDate,
    ...founderBusyByDate,
    ...sessionsByDate.map((day) => day.map(sessionWindow)),
  ].flat();
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

  function barStyle(slot: TimeWindow, top: number, color: string, opacity = 1) {
    const left = ((toMinutes(slot.start) - rangeStart) / rangeSpan) * 100;
    const width = ((toMinutes(slot.end) - toMinutes(slot.start)) / rangeSpan) * 100;
    return {
      position: "absolute" as const,
      left: `${left}%`,
      width: `${width}%`,
      top,
      height: BAR_HEIGHT,
      backgroundColor: color,
      opacity,
      borderRadius: 4,
    };
  }

  // Diagonal hatch, not a solid fill — reads as "blocked for a reason", not
  // as a third tutor color, since it's the founder's personal calendar
  // rather than a tutoring assignment.
  function hatchStyle(slot: TimeWindow, top: number) {
    return {
      ...barStyle(slot, top, "transparent", 1),
      backgroundImage: `repeating-linear-gradient(45deg, ${PERSONAL_BUSY_COLOR} 0, ${PERSONAL_BUSY_COLOR} 2px, transparent 2px, transparent 6px)`,
      border: `1px solid ${PERSONAL_BUSY_COLOR}55`,
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
          <span
            className="inline-block w-3 h-2.5 rounded-sm"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, ${PERSONAL_BUSY_COLOR} 0, ${PERSONAL_BUSY_COLOR} 1.5px, transparent 1.5px, transparent 4px)`,
              border: `1px solid ${PERSONAL_BUSY_COLOR}55`,
            }}
          />
          <span className="text-xs text-gray-700">{founderName}'s calendar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-px border-t border-dashed border-gray-900" />
          <span className="text-xs text-gray-700">Now</span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Solid = booked. Pale = open, unbooked.
      </p>
      {busyCheckFailed && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
          Couldn't check {founderName}'s personal calendar just now — this view may be missing
          some of his busy time.
        </p>
      )}

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
                className={`relative flex-1 rounded-md overflow-hidden ${
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
                    style={barStyle(slot, 0, FOUNDER_COLOR, OPEN_OPACITY)}
                    title={`${founderName}: open ${rangeLabel(slot)}`}
                  />
                ))}
                {secondByDate[dayIndex].map((slot, i) => (
                  <div
                    key={`s-${i}`}
                    style={barStyle(slot, BAR_HEIGHT + BAR_GAP, SECOND_COLOR, OPEN_OPACITY)}
                    title={`${secondTutorName}: open ${rangeLabel(slot)}`}
                  />
                ))}
                {founderBusyByDate[dayIndex].map((slot, i) => (
                  <div
                    key={`fb-${i}`}
                    style={hatchStyle(slot, 0)}
                    title={`${founderName}'s calendar: busy ${rangeLabel(slot)}`}
                  />
                ))}
                {founderSessionsByDate[dayIndex].map((s) => (
                  <div
                    key={`fs-${s.id}`}
                    style={barStyle(sessionWindow(s), 0, FOUNDER_COLOR)}
                    title={`${founderName}: ${s.studentName || s.studentEmail} — ${s.subject} (${rangeLabel(sessionWindow(s))})`}
                  />
                ))}
                {secondSessionsByDate[dayIndex].map((s) => (
                  <div
                    key={`ss-${s.id}`}
                    style={barStyle(sessionWindow(s), BAR_HEIGHT + BAR_GAP, SECOND_COLOR)}
                    title={`${secondTutorName}: ${s.studentName || s.studentEmail} — ${s.subject} (${rangeLabel(sessionWindow(s))})`}
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
