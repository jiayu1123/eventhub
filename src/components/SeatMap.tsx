
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BookingDraft } from "../types/booking";
import type { Seat } from "../types/seat";
import { fetchEventSeats } from "../api/seats";

interface SeatMapProps {
  basePrice: number;
  eventId: number;
}

export default function SeatMap({
  eventId,
}: SeatMapProps) {
  const navigate = useNavigate();

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSeats = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchEventSeats(eventId);

        if (!active) return;

        setSeats(data);
        setSelectedSeats((previous) =>
          previous.filter((id) =>
            data.some(
              (seat) =>
                seat.id === id &&
                seat.status === "available"
            )
          )
        );
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load seats"
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSeats();

    return () => {
      active = false;
    };
  }, [eventId]);

  const toggleSeat = (seatId: string) => {
    const seat = seats.find((item) => item.id === seatId);

    if (!seat || seat.status === "sold") return;

    setSelectedSeats((previous) =>
      previous.includes(seatId)
        ? previous.filter((id) => id !== seatId)
        : [...previous, seatId]
    );
  };

  const totalPrice = seats
    .filter((seat) => selectedSeats.includes(seat.id))
    .reduce((total, seat) => total + seat.price, 0);

  const handleCheckout = () => {
    const selected = seats.filter(
      (seat) =>
        selectedSeats.includes(seat.id) &&
        seat.status === "available"
    );

    if (selected.length === 0) return;

    const draft: BookingDraft = {
      eventId,
      seats: selected.map(({ id, price }) => ({
        id,
        price,
      })),
    };

    navigate("/checkout", {
      state: { draft },
    });
  };

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border bg-white p-6">
        Loading available seats...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border bg-white p-6">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-2xl font-bold">
        Select Your Seats
      </h2>

      <div className="mx-auto mt-8 max-w-lg">
        <div className="mb-8 rounded-lg bg-gray-200 py-3 text-center font-semibold">
          STAGE
        </div>

        <div className="grid grid-cols-8 gap-2">
          {seats.map((seat) => {
            const isSelected = selectedSeats.includes(seat.id);
            const isSold = seat.status === "sold";

            return (
              <button
                key={seat.id}
                type="button"
                disabled={isSold}
                onClick={() => toggleSeat(seat.id)}
                className={`rounded-md p-2 text-xs font-medium transition ${
                  isSold
                    ? "cursor-not-allowed bg-gray-300 text-gray-500"
                    : isSelected
                      ? "bg-purple-600 text-white"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                }`}
              >
                {seat.id}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <span>🟢 Available</span>
        <span>🟣 Selected</span>
        <span>⚪ Sold</span>
      </div>

      <div className="mt-6 border-t pt-5">
        <p className="font-medium">
          Selected Seats: {selectedSeats.join(", ") || "None"}
        </p>

        <p className="mt-2 text-xl font-bold">
          Total: ${totalPrice}
        </p>

        <button
          type="button"
          disabled={selectedSeats.length === 0}
          onClick={handleCheckout}
          className="mt-4 rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to Checkout
        </button>
      </div>
    </div>
  );
}
