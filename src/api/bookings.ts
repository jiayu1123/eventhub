
import type { Booking } from "../types/booking";
import { fetchEventSeats } from "./seats";

interface CreateBookingRequest {
  eventId: number;
  seats: string[];
}

interface JavaBookingResponse {
  bookingId: number;
  eventId: number;
  seats: string[];
  status: string;
}

interface CsrfResponse {
  headerName: string;
  token: string;
}

interface CurrentUserResponse {
  id: number;
  email: string;
}

// Response from GET /api/bookings/{bookingId}
export interface BookingDetailResponse {
  bookingId: number;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
  eventId: number;
  eventTitle: string;
  city: string;
  venue: string;
  startsAt: string;
  seats: {
    seatLabel: string;
    priceCents: number;
  }[];
}

export class BookingApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingApiError";
    this.status = status;
  }
}

async function getCsrf(): Promise<CsrfResponse> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new BookingApiError(
      "Failed to obtain CSRF token",
      response.status
    );
  }

  return response.json();
}

// Fetch one booking directly from PostgreSQL through Spring Boot.
export async function fetchBookingById(
  bookingId: number
): Promise<BookingDetailResponse> {
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    throw new BookingApiError("Invalid booking ID.", 400);
  }

  const response = await fetch(`/api/bookings/${bookingId}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Failed to load booking details.";

    if (response.status === 401) {
      message = "Please log in to view your booking.";
    } else if (response.status === 403) {
      message = "You do not have permission to view this booking.";
    } else if (response.status === 404) {
      message = "Booking not found.";
    }

    throw new BookingApiError(message, response.status);
  }

  return response.json() as Promise<BookingDetailResponse>;
}

// Create a booking with one or multiple seats.
export async function createBooking(
  request: CreateBookingRequest
): Promise<Booking> {
  if (!request.seats.length) {
    throw new BookingApiError(
      "Please select at least one seat.",
      400
    );
  }

  // Fetch actual seat prices and availability.
  const availableSeats = await fetchEventSeats(
    request.eventId
  );

  const selectedSeats = request.seats.map((seatId) =>
    availableSeats.find((seat) => seat.id === seatId)
  );

  if (
    selectedSeats.some(
      (seat) => !seat || seat.status !== "available"
    )
  ) {
    throw new BookingApiError(
      "One or more selected seats are no longer available.",
      409
    );
  }

  // Get the authenticated customer.
  const userResponse = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!userResponse.ok) {
    throw new BookingApiError(
      "Your session has expired. Please log in again.",
      userResponse.status
    );
  }

  const currentUser: CurrentUserResponse =
    await userResponse.json();

  // Obtain the CSRF token.
  const csrf = await getCsrf();

  // Create the booking in PostgreSQL.
  const response = await fetch("/api/bookings", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = "Failed to create booking";

    if (response.status === 409) {
      message =
        "One or more selected seats have already been booked.";
    } else if (response.status === 401) {
      message =
        "Your session has expired. Please log in again.";
    } else if (response.status === 403) {
      message =
        "Your request was rejected. Please refresh and try again.";
    }

    throw new BookingApiError(message, response.status);
  }

  const result: JavaBookingResponse =
    await response.json();

  const bookingSeats = selectedSeats.map((seat) => ({
    id: seat!.id,
    price: seat!.price,
  }));

  const totalPrice = bookingSeats.reduce(
    (total, seat) => total + seat.price,
    0
  );

  return {
    bookingId: String(result.bookingId),
    eventId: result.eventId,
    seats: bookingSeats,
    customerName: currentUser.email.split("@")[0],
    customerEmail: currentUser.email,
    totalPrice,
    createdAt: new Date().toISOString(),
  };
}
