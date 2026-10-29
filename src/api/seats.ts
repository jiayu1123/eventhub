import type { Seat } from "../types/seat";

interface JavaSeat {
  id: number;
  eventId: number;
  seatLabel: string;
  priceCents: number;
  available: boolean;
}

function toFrontendSeat(seat: JavaSeat): Seat {
  const match = seat.seatLabel.match(/^([A-Za-z]+)(\d+)$/);

  return {
    id: seat.seatLabel,
    row: match ? match[1] : seat.seatLabel,
    number: match ? Number(match[2]) : 0,
    price: seat.priceCents / 100,
    status: seat.available ? "available" : "sold",
  };
}

export async function fetchEventSeats(
  eventId: number
): Promise<Seat[]> {
  const response = await fetch(
    `/api/events/${eventId}/seats`
  );

  if (!response.ok) {
    throw new Error("Failed to load seats");
  }

  const data: JavaSeat[] = await response.json();

  return data.map(toFrontendSeat);
}
