
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface JavaBookingSeat {
  seatLabel: string;
  priceCents: number;
}

interface JavaBooking {
  bookingId: number;
  eventId: number;
  eventTitle: string;
  city: string;
  venue: string;
  startsAt: string;
  createdAt: string;
  status: string;
  seats: JavaBookingSeat[];
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getTotalCents(booking: JavaBooking): number {
  return booking.seats.reduce(
    (total, seat) => total + seat.priceCents,
    0
  );
}

async function getCsrf(): Promise<{
  headerName: string;
  token: string;
}> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to obtain CSRF token.");
  }

  return response.json();
}

async function fetchMyBookings(): Promise<JavaBooking[]> {
  const response = await fetch("/api/bookings/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load bookings (${response.status}).`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected booking response format.");
  }

  return data as JavaBooking[];
}

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();

  const userId = user?.userId;

  const [bookings, setBookings] = useState<JavaBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] =
    useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");


  useEffect(() => {
    if (authLoading || !userId) {
      return;
    }

    let active = true;

    async function loadBookings() {
      try {
        const data = await fetchMyBookings();

        if (active) {
          setBookings(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setBookings([]);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load bookings."
          );
        }
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
  }, [userId, authLoading]);


  const selectedBooking =
    bookings.find(
      (booking) => booking.bookingId === selectedBookingId
    ) ?? null;

  function handleViewDetails(bookingId: number) {
    if (cancelling) return;

    setSelectedBookingId(bookingId);
    setShowCancelConfirm(false);
    setError("");
    setSuccessMessage("");
  }

  function closeDetails() {
    if (cancelling) return;

    setSelectedBookingId(null);
    setShowCancelConfirm(false);
  }

  async function handleCancelBooking() {
    if (
      !selectedBooking ||
      selectedBooking.status !== "CONFIRMED" ||
      cancelling
    ) {
      return;
    }

    const bookingId = selectedBooking.bookingId;

    setCancelling(true);
    setError("");
    setSuccessMessage("");

    try {
      const csrf = await getCsrf();

      const response = await fetch(
        `/api/bookings/${bookingId}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            [csrf.headerName]: csrf.token,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Cancellation was rejected. Please refresh and try again."
          );
        }

        throw new Error(
          `Failed to cancel booking (${response.status}).`
        );
      }

      // Reload persisted history after cancellation.
      const updatedBookings = await fetchMyBookings();

      setBookings(updatedBookings);
      setSelectedBookingId(bookingId);
      setShowCancelConfirm(false);

      setSuccessMessage(
        `Booking #${bookingId} was cancelled successfully. The reserved seats have been released.`
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

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-gray-600">
          Checking your session...
        </p>
      </main>
    );
  }

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

      {successMessage && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700"
        >
          {successMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">
            Booking History
          </h2>

          <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
            {bookings.length}{" "}
            {bookings.length === 1 ? "booking" : "bookings"}
          </span>
        </div>

        {loading ? (
          <div className="mt-5 rounded-xl border bg-white p-8 text-center text-gray-600">
            Loading your bookings...
          </div>
        ) : bookings.length === 0 && !error ? (
          <div className="mt-5 rounded-xl border bg-white p-8 text-center">
            <h3 className="text-lg font-bold">
              No bookings yet
            </h3>

            <p className="mt-2 text-gray-600">
              You haven't made any reservations with this
              account yet.
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
              const isSelected =
                selectedBookingId === booking.bookingId;

              const isCancelled =
                booking.status === "CANCELLED";

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
                        Booking #{booking.bookingId}
                      </p>

                      <h3 className="mt-2 text-xl font-bold">
                        {booking.eventTitle}
                      </h3>

                      <p className="mt-2 text-sm text-gray-600">
                        {formatDate(booking.startsAt)}
                        {" · "}
                        {booking.venue}, {booking.city}
                      </p>

                      <span
                        className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          isCancelled
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <p className="text-xl font-bold text-purple-700">
                      {formatMoney(getTotalCents(booking))}
                    </p>
                  </div>

                  <div className="mt-4 text-sm text-gray-600">
                    <p>
                      Seats:{" "}
                      {booking.seats
                        .map((seat) => seat.seatLabel)
                        .join(", ")}
                    </p>

                    <p className="mt-1">
                      Booked: {formatDate(booking.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() =>
                      handleViewDetails(booking.bookingId)
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
        )}
      </section>

      {selectedBooking && (
        <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2
                className={`text-2xl font-bold ${
                  selectedBooking.status === "CANCELLED"
                    ? "text-gray-600"
                    : "text-green-700"
                }`}
              >
                {selectedBooking.status === "CANCELLED"
                  ? "Booking Cancelled"
                  : "Booking Confirmed"}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Reference: #{selectedBooking.bookingId}
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

          <div className="mt-6 rounded-lg bg-purple-50 p-5">
            <h3 className="text-lg font-bold">
              Event Details
            </h3>

            <p className="mt-3 text-xl font-semibold">
              {selectedBooking.eventTitle}
            </p>

            <p className="mt-2 text-gray-700">
              Date: {formatDate(selectedBooking.startsAt)}
            </p>

            <p className="mt-2 text-gray-700">
              Location: {selectedBooking.venue},{" "}
              {selectedBooking.city}
            </p>

            <Link
              to={`/events/${selectedBooking.eventId}`}
              className="mt-3 inline-block font-semibold text-purple-700 hover:underline"
            >
              View Event →
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between gap-4">
              <span>Customer</span>
              <strong>{user.name}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span>Email</span>
              <span className="break-all text-right">
                {user.email}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span>Booked At</span>
              <span>
                {formatDate(selectedBooking.createdAt)}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold">
              Seat Breakdown
            </h3>

            <div className="mt-4 space-y-3">
              {selectedBooking.seats.map((seat) => (
                <div
                  key={seat.seatLabel}
                  className="flex justify-between rounded-lg border px-4 py-3"
                >
                  <span>Seat {seat.seatLabel}</span>
                  <strong>
                    {formatMoney(seat.priceCents)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-between border-t pt-5 text-xl">
            <strong>Reservation Total</strong>
            <strong className="text-purple-700">
              {formatMoney(getTotalCents(selectedBooking))}
            </strong>
          </div>

          {selectedBooking.status === "CONFIRMED" && (
            <div className="mt-8 border-t pt-6">
              {!showCancelConfirm ? (
                <button
                  type="button"
                  disabled={cancelling}
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
                    all reserved seats. Your booking will remain
                    in your history.
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
          )}
        </section>
      )}
    </main>
  );
}
