import type { BookingDraft } from "../types/booking";
import type { BookingProposal } from "./aiBookingAgent";
import { fetchEventSeats } from "./seats";

export async function createDraftFromProposal(
  proposal: BookingProposal
): Promise<BookingDraft> {
  if (
    !Number.isSafeInteger(proposal.eventId) ||
    proposal.eventId <= 0 ||
    !Array.isArray(proposal.seats) ||
    proposal.seats.length === 0 ||
    proposal.seats.length > 10 ||
    new Set(proposal.seats).size !== proposal.seats.length
  ) {
    throw new Error("Invalid AI booking proposal.");
  }

  const availableSeats = await fetchEventSeats(proposal.eventId);

  const selectedSeats = proposal.seats.map((seatLabel) =>
    availableSeats.find((seat) => seat.id === seatLabel)
  );

  if (
    selectedSeats.some(
      (seat) => !seat || seat.status !== "available"
    )
  ) {
    throw new Error(
      "One or more recommended seats are no longer available. Please ask the AI to find another pair."
    );
  }

  return {
    eventId: proposal.eventId,
    seats: selectedSeats.map((seat) => ({
      id: seat!.id,
      price: seat!.price,
    })),
  };
}
