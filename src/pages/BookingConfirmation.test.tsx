
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";

import BookingConfirmation from "./BookingConfirmation";
import * as bookingsApi from "../api/bookings";

// Mock the Booking API while preserving the real error class.
vi.mock("../api/bookings", async () => {
  const actual = await vi.importActual<
    typeof import("../api/bookings")
  >("../api/bookings");

  return {
    ...actual,
    fetchBookingById: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Test 1: Successfully load a confirmed booking.
test("displays confirmed booking details from the API", async () => {
  const mockBooking: bookingsApi.BookingDetailResponse = {
    bookingId: 7,
    status: "CONFIRMED",
    createdAt: "2026-10-28T12:00:00Z",
    eventId: 1,
    eventTitle: "Boston Music Festival",
    city: "Boston",
    venue: "TD Garden",
    startsAt: "2026-11-15T19:00:00Z",
    seats: [
      {
        seatLabel: "A1",
        priceCents: 10000,
      },
      {
        seatLabel: "A2",
        priceCents: 12000,
      },
    ],
  };

  vi.mocked(bookingsApi.fetchBookingById).mockResolvedValue(
    mockBooking
  );

  render(
    <MemoryRouter initialEntries={["/confirmation/7"]}>
      <Routes>
        <Route
          path="/confirmation/:bookingId"
          element={<BookingConfirmation />}
        />
      </Routes>
    </MemoryRouter>
  );

  // Loading state.
  expect(
    screen.getByText("Loading booking details...")
  ).toBeInTheDocument();

  // Confirmed state.
  expect(
    await screen.findByRole("heading", {
      name: "Booking Confirmed!",
    })
  ).toBeInTheDocument();

  // Event information.
  expect(
    screen.getByText("Boston Music Festival")
  ).toBeInTheDocument();

  expect(screen.getByText("TD Garden, Boston"))
    .toBeInTheDocument();

  // Reserved seats.
  expect(screen.getByText("Seat A1")).toBeInTheDocument();
  expect(screen.getByText("Seat A2")).toBeInTheDocument();

  // Total price: $100 + $120.
  expect(screen.getByText("$220.00")).toBeInTheDocument();

  // Verify the API was called with the correct booking ID.
  expect(bookingsApi.fetchBookingById)
    .toHaveBeenCalledWith(7);
});

// Test 2: Display a login message when the API returns 401.
test("shows login message when booking request returns 401", async () => {
  vi.mocked(bookingsApi.fetchBookingById).mockRejectedValue(
    new bookingsApi.BookingApiError(
      "Please log in to view your booking.",
      401
    )
  );

  render(
    <MemoryRouter initialEntries={["/confirmation/7"]}>
      <Routes>
        <Route
          path="/confirmation/:bookingId"
          element={<BookingConfirmation />}
        />
      </Routes>
    </MemoryRouter>
  );

  // The page should display an error instead of booking details.
  expect(
    await screen.findByRole("heading", {
      name: "Booking Unavailable",
    })
  ).toBeInTheDocument();

  // Verify the authentication error message.
  expect(
    screen.getByText("Please log in to view your booking.")
  ).toBeInTheDocument();

  // The user can navigate to My Bookings.
  expect(
    screen.getByRole("link", { name: "My Bookings" })
  ).toHaveAttribute("href", "/my-bookings");

  // Verify the correct booking ID was requested.
  expect(bookingsApi.fetchBookingById)
    .toHaveBeenCalledWith(7);
});


test("shows booking unavailable when the API returns 404", async () => {
  vi.mocked(bookingsApi.fetchBookingById).mockRejectedValue(
    new bookingsApi.BookingApiError("Booking not found.", 404)
  );

  render(
    <MemoryRouter initialEntries={["/confirmation/99999"]}>
      <Routes>
        <Route
          path="/confirmation/:bookingId"
          element={<BookingConfirmation />}
        />
      </Routes>
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("heading", {
      name: "Booking Unavailable",
    })
  ).toBeInTheDocument();

  expect(
    screen.getByText("Booking not found.")
  ).toBeInTheDocument();

  expect(bookingsApi.fetchBookingById)
    .toHaveBeenCalledWith(99999);
});

test("displays cancelled booking with historical seat prices", async () => {
  const cancelledBooking: bookingsApi.BookingDetailResponse = {
    bookingId: 8,
    status: "CANCELLED",
    createdAt: "2026-10-28T12:00:00Z",
    eventId: 1,
    eventTitle: "Boston Music Festival",
    city: "Boston",
    venue: "TD Garden",
    startsAt: "2026-11-15T19:00:00Z",
    seats: [
      { seatLabel: "A1", priceCents: 10000 },
      { seatLabel: "A2", priceCents: 12000 },
    ],
  };

  vi.mocked(bookingsApi.fetchBookingById)
    .mockResolvedValue(cancelledBooking);

  render(
    <MemoryRouter initialEntries={["/confirmation/8"]}>
      <Routes>
        <Route
          path="/confirmation/:bookingId"
          element={<BookingConfirmation />}
        />
      </Routes>
    </MemoryRouter>
  );

  expect(
    await screen.findByRole("heading", {
      name: "Booking Cancelled",
    })
  ).toBeInTheDocument();

  expect(screen.getByText("CANCELLED")).toBeInTheDocument();
  expect(screen.getByText("Seat A1")).toBeInTheDocument();
  expect(screen.getByText("Seat A2")).toBeInTheDocument();
  expect(screen.getByText("$220.00")).toBeInTheDocument();

  expect(
    screen.getByText(
      "Historical reservation amount. This booking is cancelled."
    )
  ).toBeInTheDocument();

  expect(bookingsApi.fetchBookingById)
    .toHaveBeenCalledWith(8);
});
