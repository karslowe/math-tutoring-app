import { describe, it, expect } from "vitest";
import { subtractBusyIntervals, zonedDateRangeToUtcISO } from "../slots";
import type { AvailabilitySlot } from "../dynamodb";

const TZ = "America/Los_Angeles";

describe("subtractBusyIntervals — booking-time re-check consistency", () => {
  // Real scenario that caused a live outage: a founder calendar event
  // 3:30-4:50 PM, with the standard 15-minute buffer, trims his 9:00 AM -
  // 10:00 PM window down to a boundary starting exactly at 5:05 PM. The
  // listing then offers a 5:05-6:05 PM slot built from that edge. The old
  // booking-time check re-derived its own independent buffered window
  // around the candidate slot — effectively re-applying the same 15-minute
  // buffer a second time — which pushed its query back to 4:50 PM, exactly
  // touching the original event's end, and incorrectly rejected the slot.
  const baseWindow: AvailabilitySlot[] = [{ start: "09:00", end: "22:00" }];
  const busy = [
    { start: "2026-10-01T22:30:00.000Z", end: "2026-10-01T23:50:00.000Z" }, // 3:30-4:50 PM PT
  ];
  const bufferMinutes = 15;

  it("trims the window to start exactly at the buffered edge (5:05 PM)", () => {
    const result = subtractBusyIntervals(baseWindow, "2026-10-01", busy, TZ, bufferMinutes);
    expect(result).toContainEqual(
      expect.objectContaining({ start: "17:05" })
    );
  });

  it("is idempotent: re-checking the exact candidate slot against the same busy data and buffer doesn't trim it further", () => {
    // What the listing offered: a single 60-minute slot carved from the
    // buffered window edge.
    const candidateSlot: AvailabilitySlot[] = [{ start: "17:05", end: "18:05" }];

    // The booking-time re-check, done correctly: run the SAME
    // subtractBusyIntervals logic again (not an independently re-buffered
    // window) against just the candidate slot.
    const result = subtractBusyIntervals(candidateSlot, "2026-10-01", busy, TZ, bufferMinutes);

    // The slot must survive unchanged — it was already buffer-safe by
    // construction. This is the property the booking-time check now
    // relies on instead of independently re-padding around the slot.
    expect(result).toEqual(candidateSlot);
  });
});

describe("zonedDateRangeToUtcISO", () => {
  it("covers the full local day, not a naive UTC midnight boundary", () => {
    const { startISO, endISO } = zonedDateRangeToUtcISO("2026-10-05", "2026-10-05", TZ);
    expect(startISO).toBe("2026-10-05T07:00:00.000Z");
    expect(endISO).toBe("2026-10-06T06:59:59.999Z");
  });
});
