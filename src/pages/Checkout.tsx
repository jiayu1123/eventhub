
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { BookingDraft } from "../types/booking";
import type { Event } from "../types/event";
import type { Seat } from "../types/seat";

import { fetchEventById } from "../api/events";
import { fetchEventSeats } from "../api/seats";
import { createBooking } from "../api/bookings";
import { useAuth } from "../context/AuthContext";

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const draft = (
    location.state as { draft?: BookingDraft } | null
  )?.draft;

  const eventId = draft?.eventId;
  const selectedSeatCount = draft?.seats.length ?? 0;

  const [event, setEvent] = useState<Event | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    null
  );
  const [seatsUnavailable, setSeatsUnavailable] = useState(false);

  // Load event and seat data from Spring Boot.
  useEffect(() => {
    let cancelled = false;

    async function loadCheckout() {
      setLoading(true);
      setLoadError(null);
      setEvent(null);
      setSeats([]);
      setSeatsUnavailable(false);
      setSubmitError(null);

      if (!eventId || selectedSeatCount === 0) {
        setLoading(false);
        return;
      }

      try {
        const [eventData, seatData] = await Promise.all([
          fetchEventById(eventId),
          fetchEventSeats(eventId),
        ]);

        if (!cancelled) {
          setEvent(eventData);
          setSeats(seatData);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load checkout information."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCheckout();

    return () => {
      cancelled = true;
    };
  }, [eventId, selectedSeatCount]);

  // Match selected seats with the real database inventory.
  const selectedSeats =
    draft?.seats.map((selected) =>
      seats.find((seat) => seat.id === selected.id)
    ) ?? [];

  const allSeatsExist =
    selectedSeats.length > 0 &&
    selectedSeats.every((seat): seat is Seat => !!seat);

  const allSeatsAvailable =
    allSeatsExist &&
    selectedSeats.every((seat) => seat?.status === "available");

  const uniqueSeatIds = new Set(
    draft?.seats.map((seat) => seat.id) ?? []
  );

  const validDraft =
    !!draft &&
    !!event &&
    draft.seats.length > 0 &&
    uniqueSeatIds.size === draft.seats.length &&
    allSeatsExist;

  const pricedSeats = selectedSeats
    .filter((seat): seat is Seat => !!seat)
    .map((seat) => ({
      id: seat.id,
      price: seat.price,
    }));

  const totalPrice = pricedSeats.reduce(
    (total, seat) => total + seat.price,
    0
  );

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (
      !event ||
      !draft ||
      !validDraft ||
      !user ||
      submitting ||
      seatsUnavailable ||
      !allSeatsAvailable
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {

      const booking = await createBooking({
        eventId: event.id,
        seats: pricedSeats.map((seat) => seat.id),
      });

      navigate(`/confirmation/${booking.bookingId}`, {
        replace: true,
      });

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to complete booking.";

      const status =
        err !== null &&
          typeof err === "object" &&
          "status" in err &&
          typeof err.status === "number"
          ? err.status
          : undefined;

      const isSeatConflict =
        status === 409 ||
        /already booked|already reserved|already taken|no longer available|seat.*unavailable|seat.*sold/i.test(
          message
        );

      if (isSeatConflict) {
        setSeatsUnavailable(true);
        setSubmitError(
          "One or more selected seats are no longer available. Please return to the event page and choose different seats."
        );
      } else if (status === 401) {
        setSubmitError(
          "Your session has expired. Please log in again to complete your booking."
        );
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-10 text-center">
        <p className="text-gray-600">
          Loading checkout information...
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-gray-50 p-10 text-center">
        <h1 className="text-2xl font-bold">
          Unable to Load Checkout
        </h1>
        <p className="mt-3 text-red-600">{loadError}</p>
        <Link
          to="/"
          className="mt-5 inline-block text-purple-600 hover:underline"
        >
          Back to Events
        </Link>
      </main>
    );
  }

  if (!validDraft || !event || !draft) {
    return (
      <main className="min-h-screen bg-gray-50 p-10 text-center">
        <h1 className="text-2xl font-bold">
          No valid booking found
        </h1>
        <p className="mt-3 text-gray-600">
          Please select your seats again.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block text-purple-600 hover:underline"
        >
          Back to Events
        </Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">
            Login Required
          </h1>

          <p className="mt-4 text-gray-600">
            Please log in to complete your booking.
            Your selected seats are not reserved yet.
          </p>

          <Link
            to="/login"
            state={{
              from: "/checkout",
              draft,
            }}
            className="mt-6 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Log In
          </Link>

          <p className="mt-5 text-sm text-gray-500">
            Don't have an account?
          </p>

          <Link
            to="/register"
            state={{
              from: "/checkout",
              draft,
            }}
            className="mt-2 inline-block font-semibold text-purple-700 hover:underline"
          >
            Create an Account
          </Link>

          <div className="mt-6">
            <Link
              to={`/events/${event.id}`}
              className="text-gray-600 hover:underline"
            >
              Back to Seat Selection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to={`/events/${event.id}`}
          className="text-purple-600 hover:underline"
        >
          ← Back to Seat Selection
        </Link>

        <h1 className="mt-8 text-3xl font-bold">
          Checkout
        </h1>

        <p className="mt-2 text-gray-600">
          Review your order before confirming.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">
            Order Summary
          </h2>

          <p className="mt-4 font-semibold">
            {event.title}
          </p>

          <p className="text-gray-600">
            {event.location} · {event.date}
          </p>

          <div className="mt-6 space-y-3">
            {pricedSeats.map((seat) => (
              <div
                key={seat.id}
                className="flex justify-between"
              >
                <span>Seat {seat.id}</span>
                <span>${seat.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between border-t pt-5 text-xl font-bold">
            <span>Total</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <h2 className="text-xl font-bold">
            Customer Information
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            This booking will be linked to your EventHub account.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Account Name
              </p>
              <p className="mt-1 rounded-lg bg-gray-50 px-4 py-3 font-semibold">
                {user.name}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">
                Email Address
              </p>
              <p className="mt-1 break-all rounded-lg bg-gray-50 px-4 py-3">
                {user.email}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-gray-500">
            Demo only. No payment will be processed.
          </p>

          {!allSeatsAvailable && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
            >
              <h3 className="font-bold text-red-700">
                Selected Seats Are No Longer Available
              </h3>
              <p className="mt-2 text-sm text-red-700">
                One or more selected seats have already been reserved.
                Please choose different seats.
              </p>
              <Link
                to={`/events/${event.id}`}
                className="mt-4 inline-block font-semibold text-purple-700 hover:underline"
              >
                Back to Seat Selection
              </Link>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
            >
              <h3 className="font-bold text-red-700">
                {seatsUnavailable
                  ? "Selected Seats Are No Longer Available"
                  : "Booking Failed"}
              </h3>

              <p className="mt-2 text-sm text-red-700">
                {submitError}
              </p>

              {seatsUnavailable && (
                <Link
                  to={`/events/${event.id}`}
                  className="mt-4 inline-block font-semibold text-purple-700 hover:underline"
                >
                  Back to Seat Selection
                </Link>
              )}

              {statusMessageIsSessionExpired(submitError) && (
                <Link
                  to="/login"
                  state={{
                    from: "/checkout",
                    draft,
                  }}
                  className="mt-4 block font-semibold text-purple-700 hover:underline"
                >
                  Log In Again
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              seatsUnavailable ||
              !allSeatsAvailable
            }
            className="mt-6 w-full rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing..."
              : !allSeatsAvailable || seatsUnavailable
                ? "Seats Unavailable"
                : "Confirm Booking"}
          </button>
        </form>
      </div>
    </main>
  );
}

function statusMessageIsSessionExpired(message: string): boolean {
  return /session has expired/i.test(message);
}
