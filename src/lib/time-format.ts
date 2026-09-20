export type Meridiem = "AM" | "PM";

export interface Time12 {
  hour: number; // 1-12
  minute: number; // 0-59
  meridiem: Meridiem;
}

/**
 * Converts a stored "HH:MM" 24-hour string into 12-hour parts for display,
 * so the availability/blocks editors never show tutors military time.
 */
export function to12Hour(hhmm: string): Time12 {
  const [hStr, mStr] = hhmm.split(":");
  const h24 = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;
  const meridiem: Meridiem = h24 >= 12 ? "PM" : "AM";
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour, minute, meridiem };
}

/** Inverse of to12Hour — produces the "HH:MM" 24-hour string used in storage. */
export function from12Hour(hour: number, minute: number, meridiem: Meridiem): string {
  const h24 = (hour % 12) + (meridiem === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Each of these changes exactly one 12-hour component of a stored "HH:MM"
 * string, leaving the other two untouched — in particular, changing the hour
 * or meridiem must never perturb the minute, even when a picker only offers
 * a rounded subset of minutes to choose from.
 */
export function withHour(hhmm: string, hour: number): string {
  const { minute, meridiem } = to12Hour(hhmm);
  return from12Hour(hour, minute, meridiem);
}

export function withMinute(hhmm: string, minute: number): string {
  const { hour, meridiem } = to12Hour(hhmm);
  return from12Hour(hour, minute, meridiem);
}

export function withMeridiem(hhmm: string, meridiem: Meridiem): string {
  const { hour, minute } = to12Hour(hhmm);
  return from12Hour(hour, minute, meridiem);
}
