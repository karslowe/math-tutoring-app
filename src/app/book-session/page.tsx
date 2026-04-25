"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CalendarGrid from "@/components/CalendarGrid";
import TimeSlotPicker from "@/components/TimeSlotPicker";
import BookingModal from "@/components/BookingModal";
import Link from "next/link";
import { format, parseISO, addDays } from "date-fns";

interface DaySlots {
  date: string;
  slots: string[];
}

interface Booking {
  id: string;
  scheduledAt: string;
  subject: string;
  status: string;
}

export default function BookSessionPage() {
  const { getToken } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [slotsData, setSlotsData] = useState<DaySlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [freeCredits, setFreeCredits] = useState(0);

  const markedDates = new Set(
    slotsData.filter((d) => d.slots.length > 0).map((d) => d.date)
  );

  const loadSlots = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    setLoadingSlots(true);
    try {
      const now = new Date();
      const start = format(now, "yyyy-MM-dd");
      const end = format(addDays(now, 14), "yyyy-MM-dd");

      const res = await fetch(
        `/api/slots?startDate=${start}&endDate=${end}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSlotsData(data.days || []);
    } catch (error) {
      console.error("Failed to load slots:", error);
    } finally {
      setLoadingSlots(false);
    }
  }, [getToken]);

  const loadBookings = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch("/api/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Failed to load bookings:", error);
    } finally {
      setLoadingBookings(false);
    }
  }, [getToken]);

  const loadCredits = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/profile/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFreeCredits(data.credits || 0);
      }
    } catch {}
  }, [getToken]);

  useEffect(() => {
    loadSlots();
    loadBookings();
    loadCredits();
  }, [loadSlots, loadBookings, loadCredits]);

  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function handleSlotSelect(slot: string) {
    setSelectedSlot(slot);
    setShowModal(true);
  }

  async function handleBookConfirm(subject: string, useFreeCredit: boolean) {
    const token = await getToken();
    if (!token || !selectedSlot) return;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ scheduledAt: selectedSlot, subject, useFreeCredit }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to book session");
    }

    setShowModal(false);
    setSelectedSlot(null);
    // Refresh data
    await Promise.all([loadSlots(), loadBookings(), loadCredits()]);
  }

  async function handleCancel(sessionId: string) {
    const token = await getToken();
    if (!token) return;

    setCancellingId(sessionId);
    try {
      const res = await fetch(`/api/bookings?sessionId=${sessionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to cancel booking");
        return;
      }

      await Promise.all([loadSlots(), loadBookings()]);
    } catch (error) {
      console.error("Cancel error:", error);
    } finally {
      setCancellingId(null);
    }
  }

  const selectedDateStr = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : null;
  const selectedDaySlots = selectedDateStr
    ? slotsData.find((d) => d.date === selectedDateStr)?.slots || []
    : [];

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Book a Session
        </h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <div>
            <CalendarGrid
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              markedDates={markedDates}
            />
          </div>

          {/* Time slots */}
          <div>
            {selectedDate && selectedDateStr ? (
              <TimeSlotPicker
                date={selectedDateStr}
                availableSlots={selectedDaySlots}
                selectedSlot={selectedSlot}
                onSlotSelect={handleSlotSelect}
                loading={loadingSlots}
              />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-500 text-center">
                  Select a date to see available time slots
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming bookings */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Upcoming Sessions
          </h2>

          {loadingBookings ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse bg-gray-100 rounded-xl h-16"
                />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-gray-500 text-sm">
                No upcoming sessions. Book one above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings
                .sort(
                  (a, b) =>
                    new Date(a.scheduledAt).getTime() -
                    new Date(b.scheduledAt).getTime()
                )
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.subject}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(
                          parseISO(booking.scheduledAt),
                          "EEEE, MMMM d 'at' h:mm a"
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {cancellingId === booking.id
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Booking modal */}
        {showModal && selectedSlot && (
          <BookingModal
            slot={selectedSlot}
            onConfirm={handleBookConfirm}
            onCancel={() => {
              setShowModal(false);
              setSelectedSlot(null);
            }}
            freeCredits={freeCredits}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
