"use client";

import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  addDays,
  startOfDay,
} from "date-fns";

interface CalendarGridProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  markedDates?: Set<string>; // Set of YYYY-MM-DD strings with available slots
}

export default function CalendarGrid({
  selectedDate,
  onDateSelect,
  markedDates = new Set(),
}: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = startOfDay(new Date());
  const bookingCutoff = addDays(today, 14);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = isBefore(day, today);
          const isTooFar = isAfter(day, bookingCutoff);
          const isDisabled = isPast || isTooFar || !isCurrentMonth;
          const hasSlots = markedDates.has(dateStr);
          const isDayToday = isToday(day);

          return (
            <button
              key={dateStr}
              onClick={() => !isDisabled && onDateSelect(day)}
              disabled={isDisabled}
              className={`
                relative p-2 text-sm rounded-lg transition-all text-center
                ${!isCurrentMonth ? "text-gray-300 cursor-default" : ""}
                ${isPast && isCurrentMonth ? "text-gray-400 cursor-not-allowed" : ""}
                ${isTooFar && isCurrentMonth ? "text-gray-300 cursor-not-allowed" : ""}
                ${!isDisabled && !isSelected ? "hover:bg-blue-50 cursor-pointer" : ""}
                ${isSelected ? "bg-blue-600 text-white font-semibold" : ""}
                ${isDayToday && !isSelected ? "font-bold text-blue-600" : ""}
                ${!isDisabled && !isSelected ? "text-gray-900" : ""}
              `}
            >
              {format(day, "d")}
              {hasSlots && !isSelected && !isDisabled && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-600 rounded-full" />
          <span>Selected</span>
        </div>
      </div>
    </div>
  );
}
