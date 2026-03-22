"use client";

import { format, parseISO } from "date-fns";

interface TimeSlotPickerProps {
  date: string; // YYYY-MM-DD
  availableSlots: string[]; // ISO datetime strings
  selectedSlot: string | null;
  onSlotSelect: (slot: string) => void;
  loading?: boolean;
}

export default function TimeSlotPicker({
  date,
  availableSlots,
  selectedSlot,
  onSlotSelect,
  loading = false,
}: TimeSlotPickerProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-2">
          {format(parseISO(date), "EEEE, MMMM d")}
        </h3>
        <p className="text-sm text-gray-500">
          No available time slots for this date.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-3">
        Available times for {format(parseISO(date), "EEEE, MMMM d")}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableSlots.map((slot) => {
          const isSelected = selectedSlot === slot;
          const time = parseISO(slot);
          return (
            <button
              key={slot}
              onClick={() => onSlotSelect(slot)}
              className={`
                px-3 py-2.5 rounded-lg text-sm font-medium transition-all border
                ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                }
              `}
            >
              {format(time, "h:mm a")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
