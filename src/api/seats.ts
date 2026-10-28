
import type { Seat } from "../types/seat";

interface SeatsResponse {
  success: boolean;
  data?: Seat[];
  message?: string;
}

export async function fetchEventSeats(
  eventId: number
): Promise<Seat[]> {
  const response = await fetch(
    `http://localhost:3001/api/events/${eventId}/seats`
  );

  const result: SeatsResponse = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message || "Failed to load seats"
    );
  }

  return result.data;
}
