import { Link, useLocation } from "react-router-dom";
import { events } from "../data/events";
import type { Booking } from "../types/booking";

export default function BookingConfirmation() {
  const location = useLocation();

  const booking = (location.state as {
    booking?: Booking;
  } | null)?.booking;

  if (!booking) {
    return (
      <main className="p-10 text-center">
        <h1 className="text-2xl font-bold">
          No booking confirmation found
        </h1>
        <Link to="/" className="mt-4 inline-block text-purple-600">
          Back to Events
        </Link>
      </main>
    );
  }

  const event = events.find(
    (item) => item.id === booking.eventId
  );

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">🎉</div>

        <h1 className="mt-5 text-3xl font-bold text-green-700">
          Booking Confirmed!
        </h1>

        <p className="mt-3 text-gray-600">
          Your demo reservation has been created.
        </p>

        <div className="mt-8 rounded-xl bg-gray-50 p-6 text-left">
          <p className="text-sm text-gray-500">
            Booking Reference
          </p>

          <p className="mt-1 text-xl font-bold">
            {booking.bookingId}
          </p>

          <div className="mt-5 space-y-3">
            <p>
              <strong>Event:</strong> {event?.title ?? "Unknown"}
            </p>

            <p>
              <strong>Name:</strong> {booking.customerName}
            </p>

            <p>
              <strong>Email:</strong> {booking.customerEmail}
            </p>

            <p>
              <strong>Seats:</strong>{" "}
              {booking.seats.map((seat) => seat.id).join(", ")}
            </p>

            <p>
              <strong>Total:</strong> ${booking.totalPrice}
            </p>
          </div>
        </div>

        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
        >
          Explore More Events
        </Link>
      </div>
    </main>
  );
}