
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { events } from "../data/events";
import type { BookingDraft } from "../types/booking";
import { createBooking } from "../api/bookings";
import { useAuth } from "../context/AuthContext";

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const draft = (
    location.state as { draft?: BookingDraft } | null
  )?.draft;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    null
  );
  const [seatsUnavailable, setSeatsUnavailable] =
    useState(false);

  const event = events.find(
    (item) => item.id === draft?.eventId
  );

  // Validate selected seats.
  const validSeats =
    draft?.seats.filter((seat) => {
      const row = seat.id.charAt(0);
      const number = Number(seat.id.slice(1));

      return (
        ["A", "B", "C", "D"].includes(row) &&
        Number.isInteger(number) &&
        number >= 1 &&
        number <= 8 &&
        (number - 1 + row.charCodeAt(0)) % 7 !== 0
      );
    }) ?? [];

  // Recalculate prices from event data.
  const pricedSeats = event
    ? validSeats.map((seat) => ({
        id: seat.id,
        price:
          event.price +
          (seat.id.startsWith("A")
            ? 40
            : seat.id.startsWith("B")
              ? 20
              : 0),
      }))
    : [];

  const uniqueSeatIds = new Set(
    pricedSeats.map((seat) => seat.id)
  );

  const validDraft =
    !!event &&
    !!draft &&
    draft.seats.length > 0 &&
    pricedSeats.length === draft.seats.length &&
    uniqueSeatIds.size === pricedSeats.length;

  const totalPrice = pricedSeats.reduce(
    (total, seat) => total + seat.price,
    0
  );

  // Submit booking using authenticated session.
  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (
      !event ||
      !validDraft ||
      !user ||
      submitting ||
      seatsUnavailable
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

      navigate("/confirmation", {
        replace: true,
        state: { booking },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to complete booking";

      const status =
        err !== null &&
        typeof err === "object" &&
        "status" in err &&
        typeof err.status === "number"
          ? err.status
          : undefined;

      const isSeatConflict =
        status === 409 ||
        /already booked|already reserved|already taken|no longer available|seat.*unavailable|seat.*sold|unique constraint/i.test(
          message
        );

      if (isSeatConflict) {
        setSeatsUnavailable(true);
        setSubmitError(
          "One or more selected seats have already been booked by another customer. Please return to the event page and choose different seats."
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

  // Invalid booking draft.
  if (!validDraft || !event) {
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

  // Wait until authentication has been checked.
  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-10 text-center">
        <p className="text-gray-600">
          Checking your session...
        </p>
      </main>
    );
  }

  // Require login before confirming a booking.
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

        {/* Order Summary */}
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

        {/* Authenticated Customer Information */}
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
                Full Name
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

          {/* Booking Error */}
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
                  className="mt-5 inline-block rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  Back to Seat Selection
                </Link>
              )}

              {!seatsUnavailable &&
                /session has expired/i.test(submitError) && (
                  <Link
                    to="/login"
                    state={{
                      from: "/checkout",
                      draft,
                    }}
                    className="mt-4 inline-block font-semibold text-purple-700 hover:underline"
                  >
                    Log In Again
                  </Link>
                )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || seatsUnavailable}
            className="mt-6 w-full rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing..."
              : seatsUnavailable
                ? "Seats Unavailable"
                : "Confirm Booking"}
          </button>
        </form>
      </div>
    </main>
  );
}
