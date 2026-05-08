"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";

interface SessionLike {
  scheduledAt: string;
}

interface MiniCalendarProps {
  sessions: SessionLike[];
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function MiniCalendar({ sessions }: MiniCalendarProps) {
  const [cursor, setCursor] = useState(() => new Date());

  const sessionDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      set.add(format(new Date(s.scheduledAt), "yyyy-MM-dd"));
    }
    return set;
  }, [sessions]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const today = new Date();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-900">
          {format(cursor, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Previous month"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="text-[10px] text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Next month"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-400 flex-shrink-0">
        {WEEKDAYS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 flex-1 auto-rows-fr min-h-0 mt-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const hasSession = sessionDays.has(format(day, "yyyy-MM-dd"));
          return (
            <div
              key={day.toISOString()}
              className={`relative flex items-center justify-center rounded text-[11px] ${
                inMonth ? "text-gray-700" : "text-gray-300"
              } ${isToday ? "bg-primary-100 font-bold text-primary-700" : ""} ${
                hasSession && !isToday ? "bg-blue-50 text-blue-700 font-medium" : ""
              }`}
            >
              {format(day, "d")}
              {hasSession && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
