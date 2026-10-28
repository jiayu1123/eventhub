
import type { Booking } from "../types/booking";

interface CreateBookingRequest {
  eventId: number;
  seats: string[];
}

interface BookingResponse {
  success: boolean;
  data?: Booking;
  message?: string;
}

// Custom API error with HTTP status
export class BookingApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingApiError";
    this.status = status;
  }
}

export async function createBooking(
  request: CreateBookingRequest
): Promise<Booking> {
  const response = await fetch(
    "http://localhost:3001/api/bookings",
    {
      method: "POST",

      // Send the authenticated session cookie.
      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(request),
    }
  );

  const result: BookingResponse = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new BookingApiError(
      result.message || "Failed to create booking",
      response.status
    );
  }

  return result.data;
}
