"use client";

import { to12Hour, withHour, withMinute, withMeridiem, Meridiem } from "@/lib/time-format";

const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // :00, :05, ... :55
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12

interface TimePickerProps {
  value: string; // "HH:MM" 24-hour
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A 12-hour AM/PM time picker with the same "HH:MM" 24-hour string contract
 * as the native <input type="time"> it replaces — that native input renders
 * in whatever 12/24-hour format the browser's OS locale dictates, which read
 * as confusing "military time" regardless of what the tutor actually prefers.
 */
export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const resolvedValue = value || "09:00";
  const { hour, minute, meridiem } = to12Hour(resolvedValue);
  const nearestMinute = MINUTES.includes(minute)
    ? minute
    : MINUTES.reduce((a, b) => (Math.abs(b - minute) < Math.abs(a - minute) ? b : a));

  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <select
        value={hour}
        onChange={(e) => onChange(withHour(resolvedValue, Number(e.target.value)))}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-gray-400">:</span>
      <select
        value={nearestMinute}
        onChange={(e) => onChange(withMinute(resolvedValue, Number(e.target.value)))}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        value={meridiem}
        onChange={(e) => onChange(withMeridiem(resolvedValue, e.target.value as Meridiem))}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

interface TimeRangeInputProps {
  start: string;
  end: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
}

export default function TimeRangeInput({
  start,
  end,
  onChangeStart,
  onChangeEnd,
}: TimeRangeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <TimePicker value={start} onChange={onChangeStart} />
      <span className="text-gray-500 text-sm">to</span>
      <TimePicker value={end} onChange={onChangeEnd} />
    </div>
  );
}
