
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  fetchBookingById,
  BookingApiError,
  type BookingDetailResponse,
} from "../api/bookings";

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();

  const [booking, setBooking] =
    useState<BookingDetailResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBooking() {
      setLoading(true);
      setError(null);
      setBooking(null);

      const id = Number(bookingId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        setError("Invalid booking ID.");
        setLoading(false);
        return;
      }

      try {
        const result = await fetchBookingById(id);

        if (!cancelled) {
          setBooking(result);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof BookingApiError) {
            setError(err.message);
          } else {
            setError("Unable to load booking details.");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBooking();

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-gray-600">
            Loading booking details...
          </p>
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Booking Unavailable
          </h1>

          <p className="mt-3 text-gray-600">
            {error ?? "Booking details could not be found."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/my-bookings"
              className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
            >
              My Bookings
            </Link>

            <Link
              to="/"
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to Events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isCancelled = booking.status === "CANCELLED";

  const totalPrice = booking.seats.reduce(
    (sum, seat) => sum + seat.priceCents,
    0
  ) / 100;

  const formattedBookingDate = new Date(
    booking.createdAt
  ).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const formattedEventDate = new Date(
    booking.startsAt
  ).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">
          {isCancelled ? "📋" : "🎉"}
        </div>

        <h1
          className={`mt-5 text-3xl font-bold ${
            isCancelled ? "text-gray-700" : "text-green-700"
          }`}
        >
          {isCancelled
            ? "Booking Cancelled"
            : "Booking Confirmed!"}
        </h1>

        <p className="mt-3 text-gray-600">
          {isCancelled
            ? "This reservation has been cancelled. Your original booking details are preserved below."
            : "Your reservation has been successfully created."}
        </p>

        <div className="mt-8 rounded-xl bg-gray-50 p-6 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">
                Booking Reference
              </p>

              <p className="mt-1 text-xl font-bold">
                #{booking.bookingId}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                isCancelled
                  ? "bg-gray-200 text-gray-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {booking.status}
            </span>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Event
              </p>

              <p className="mt-1 font-semibold">
                {booking.eventTitle}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">
                Location
              </p>

              <p className="mt-1">
                {[booking.venue, booking.city]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">
                Event Date
              </p>

              <p className="mt-1">
                {formattedEventDate}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">
                Reserved Seats
              </p>

              <div className="mt-3 space-y-2">
                {booking.seats.map((seat) => (
                  <div
                    key={seat.seatLabel}
                    className="flex justify-between rounded-lg bg-white px-4 py-3"
                  >
                    <span>Seat {seat.seatLabel}</span>

                    <span className="font-medium">
                      ${(seat.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between border-t border-gray-200 pt-5 text-lg font-bold">
              <span>Reservation Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>

            <p className="text-xs text-gray-500">
              {isCancelled
                ? "Historical reservation amount. This booking is cancelled."
                : "Demo reservation only. No payment was processed."}
            </p>

            <div>
              <p className="text-sm font-medium text-gray-500">
                Booking Date
              </p>

              <p className="mt-1">
                {formattedBookingDate}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Explore More Events
          </Link>

          <Link
            to="/my-bookings"
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            My Bookings
          </Link>
        </div>
      </div>
    </main>
  );
}
