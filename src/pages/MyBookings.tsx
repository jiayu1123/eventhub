
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Booking } from "../types/booking";

interface EventInfo {
  id: number;
  title: string;
  date: string;
  location: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
}

const API_URL = "http://localhost:3001/api";

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

async function fetchEventInfo(
  eventId: number
): Promise<EventInfo> {
  const response = await fetch(
    `${API_URL}/events/${eventId}`
  );

  const result: ApiResponse<EventInfo> =
    await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message || "Event details are unavailable."
    );
  }

  return result.data;
}

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventCache, setEventCache] = useState<
    Record<number, EventInfo>
  >({});

  const [selectedBooking, setSelectedBooking] =
    useState<Booking | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] =
    useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] =
    useState(false);

  const [error, setError] = useState("");
  const [eventError, setEventError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  // Load bookings automatically for the logged-in user.
  useEffect(() => {
    let active = true;

    if (authLoading) {
      return;
    }

    if (!user) {
      setBookings([]);
      setEventCache({});
      setSelectedBooking(null);
      setLoading(false);
      return;
    }

    // Reset state when the account changes.
    setBookings([]);
    setEventCache({});
    setSelectedBooking(null);
    setShowCancelConfirm(false);
    setError("");
    setSuccessMessage("");
    setLoading(true);

    async function loadBookings() {
      try {
        const response = await fetch(
          `${API_URL}/bookings`,
          {
            credentials: "include",
          }
        );

        const result: ApiResponse<Booking[]> =
          await response.json();

        if (
          !response.ok ||
          !result.success ||
          !Array.isArray(result.data)
        ) {
          throw new Error(
            result.message || "Failed to load bookings."
          );
        }

        if (!active) return;

        const history = result.data;
        setBookings(history);

        // Load event information for booking cards.
        const eventIds = [
          ...new Set(
            history.map((booking) => booking.eventId)
          ),
        ];

        const eventResults = await Promise.allSettled(
          eventIds.map((id) => fetchEventInfo(id))
        );

        if (!active) return;

        const loadedEvents: Record<number, EventInfo> = {};

        for (const eventResult of eventResults) {
          if (eventResult.status === "fulfilled") {
            loadedEvents[eventResult.value.id] =
              eventResult.value;
          }
        }

        setEventCache(loadedEvents);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load bookings."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBookings();

    return () => {
      active = false;
    };
  }, [user?.userId, authLoading]);

  // Open booking details.
  async function handleViewDetails(booking: Booking) {
    if (loading || cancelling || detailsLoading) return;

    setSelectedBooking(booking);
    setShowCancelConfirm(false);
    setError("");
    setEventError("");
    setSuccessMessage("");

    if (eventCache[booking.eventId]) {
      return;
    }

    setDetailsLoading(true);

    try {
      const eventInfo = await fetchEventInfo(
        booking.eventId
      );

      setEventCache((previous) => ({
        ...previous,
        [eventInfo.id]: eventInfo,
      }));
    } catch {
      setEventError(
        "Event details could not be loaded."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    if (cancelling) return;

    setSelectedBooking(null);
    setShowCancelConfirm(false);
    setEventError("");
  }

  // Cancel only the current user's booking.
  async function handleCancelBooking() {
    if (
      !selectedBooking ||
      !user ||
      cancelling ||
      loading ||
      detailsLoading
    ) {
      return;
    }

    const bookingToCancel = selectedBooking;

    setCancelling(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_URL}/bookings/${encodeURIComponent(
          bookingToCancel.bookingId
        )}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const result: ApiResponse<never> =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to cancel booking."
        );
      }

      setBookings((previous) =>
        previous.filter(
          (item) =>
            item.bookingId !== bookingToCancel.bookingId
        )
      );

      setSelectedBooking(null);
      setShowCancelConfirm(false);
      setEventError("");

      setSuccessMessage(
        "Booking cancelled successfully. Your seats are now available again."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel booking."
      );

      setShowCancelConfirm(false);
    } finally {
      setCancelling(false);
    }
  }

  // Wait for authentication to finish.
  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-gray-600">
          Checking your session...
        </p>
      </main>
    );
  }

  // Unauthenticated visitors cannot view bookings.
  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">
            My Bookings
          </h1>

          <p className="mt-4 text-gray-600">
            Please log in to view and manage your bookings.
          </p>

          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Log In
          </Link>
        </div>
      </main>
    );
  }

  const selectedEvent = selectedBooking
    ? eventCache[selectedBooking.eventId]
    : undefined;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            My Bookings
          </h1>

          <p className="mt-3 text-gray-600">
            View and manage reservations linked to your
            EventHub account.
          </p>

          <p className="mt-2 text-sm text-gray-500">
            Signed in as {user.email}
          </p>
        </div>

        <Link
          to="/"
          className="rounded-lg border px-4 py-2 font-semibold text-purple-700 hover:bg-purple-50"
        >
          Browse Events
        </Link>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700"
        >
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {/* Booking History */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">
            Booking History
          </h2>

          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
            {bookings.length}{" "}
            {bookings.length === 1
              ? "booking"
              : "bookings"}
          </span>
        </div>

        {loading ? (
          <div className="mt-5 rounded-xl border bg-white p-8 text-center text-gray-600">
            Loading your bookings...
          </div>
        ) : error && bookings.length === 0 ? null : (
          bookings.length === 0 ? (
            <div className="mt-5 rounded-xl border bg-white p-8 text-center">
              <h3 className="text-lg font-bold">
                No bookings yet
              </h3>

              <p className="mt-2 text-gray-600">
                You haven't made any reservations with
                this account yet.
              </p>

              <Link
                to="/"
                className="mt-5 inline-block rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700"
              >
                Explore Events
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {bookings.map((booking) => {
                const event = eventCache[booking.eventId];
                const isSelected =
                  selectedBooking?.bookingId ===
                  booking.bookingId;

                return (
                  <article
                    key={booking.bookingId}
                    className={`rounded-xl border bg-white p-6 shadow-sm ${
                      isSelected
                        ? "border-purple-500"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-500">
                          {booking.bookingId}
                        </p>

                        <h3 className="mt-2 text-xl font-bold">
                          {event
                            ? event.title
                            : `Event #${booking.eventId}`}
                        </h3>

                        {event && (
                          <p className="mt-2 text-sm text-gray-600">
                            {formatDate(event.date)}
                            {" · "}
                            {event.location}
                          </p>
                        )}
                      </div>

                      <p className="text-xl font-bold text-purple-700">
                        ${booking.totalPrice.toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                      <p>
                        Seats:{" "}
                        {booking.seats
                          .map((seat) => seat.id)
                          .join(", ")}
                      </p>

                      <p className="mt-1">
                        Booked:{" "}
                        {formatDate(booking.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        loading ||
                        cancelling ||
                        detailsLoading
                      }
                      onClick={() =>
                        handleViewDetails(booking)
                      }
                      className="mt-5 rounded-lg border border-purple-300 px-5 py-2 font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                    >
                      {isSelected
                        ? "Viewing Details"
                        : "View Details"}
                    </button>
                  </article>
                );
              })}
            </div>
          )
        )}
      </section>

      {/* Selected Booking Details */}
      {selectedBooking && (
        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-green-700">
                Booking Confirmed
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Reference: {selectedBooking.bookingId}
              </p>
            </div>

            <button
              type="button"
              disabled={cancelling}
              onClick={closeDetails}
              className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              Close Details
            </button>
          </div>

          {/* Event Information */}
          <div className="mt-6 rounded-lg bg-purple-50 p-5">
            <h3 className="text-lg font-bold text-gray-900">
              Event Details
            </h3>

            {selectedEvent ? (
              <div className="mt-3 space-y-2">
                <p className="text-xl font-semibold">
                  {selectedEvent.title}
                </p>

                <p className="text-gray-700">
                  Date: {formatDate(selectedEvent.date)}
                </p>

                <p className="text-gray-700">
                  Location: {selectedEvent.location}
                </p>

                <Link
                  to={`/events/${selectedEvent.id}`}
                  className="mt-3 inline-block font-semibold text-purple-700 hover:underline"
                >
                  View Event →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-gray-600">
                {detailsLoading
                  ? "Loading event details..."
                  : eventError ||
                    "Event details are unavailable."}
              </p>
            )}
          </div>

          {/* Customer Information */}
          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-4">
              <span>Customer</span>
              <strong>{selectedBooking.customerName}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span>Email</span>
              <span className="break-all text-right">
                {selectedBooking.customerEmail}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Booked At</span>
              <span>
                {formatDate(selectedBooking.createdAt)}
              </span>
            </div>
          </div>

          {/* Seat Breakdown */}
          <div className="mt-8">
            <h3 className="text-lg font-bold">
              Seat Breakdown
            </h3>

            <div className="mt-4 space-y-3">
              {selectedBooking.seats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex justify-between rounded-lg border px-4 py-3"
                >
                  <span>Seat {seat.id}</span>
                  <strong>
                    ${seat.price.toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="mt-6 flex justify-between border-t pt-5 text-xl">
            <strong>Total</strong>

            <strong className="text-purple-700">
              ${selectedBooking.totalPrice.toFixed(2)}
            </strong>
          </div>

          {/* Cancel Booking */}
          <div className="mt-8 border-t pt-6">
            {!showCancelConfirm ? (
              <button
                type="button"
                disabled={cancelling || detailsLoading}
                onClick={() =>
                  setShowCancelConfirm(true)
                }
                className="w-full rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel Booking
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-5">
                <h3 className="font-bold text-red-700">
                  Are you sure you want to cancel?
                </h3>

                <p className="mt-2 text-sm text-gray-700">
                  This will cancel your booking and release
                  all reserved seats. This action cannot
                  be undone.
                </p>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() =>
                      setShowCancelConfirm(false)
                    }
                    className="flex-1 rounded-lg border bg-white px-4 py-3 font-semibold disabled:opacity-50"
                  >
                    Keep Booking
                  </button>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancelBooking}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelling
                      ? "Cancelling..."
                      : "Confirm Cancellation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
