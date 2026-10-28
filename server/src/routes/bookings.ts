
import { Router } from "express";
import { randomUUID } from "node:crypto";

import { events } from "../data/events.js";

import {
  saveBooking,
  getBooking,
  getBookingsByUser,
  getBookedSeatIds,
  deleteBooking,
} from "../db/bookings.js";

import {
  requireAuth,
} from "../middleware/requireAuth.js";

import type {
  AuthenticatedRequest,
} from "../middleware/requireAuth.js";

import type { Booking } from "../types/booking.js";

const router = Router();

// Protect every booking endpoint.
router.use(requireAuth);

// POST /api/bookings
router.post("/", (req, res) => {
  const user = (req as AuthenticatedRequest).authUser!;

  const { eventId, seats } = req.body ?? {};

  const event = events.find(
    (item) => item.id === eventId
  );

  if (!event) {
    res.status(404).json({
      success: false,
      message: "Event not found",
    });
    return;
  }

  if (
    !Array.isArray(seats) ||
    seats.length === 0 ||
    !seats.every(
      (id: unknown) => typeof id === "string"
    )
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid booking information",
    });
    return;
  }

  const uniqueSeats = new Set<string>(seats);

  if (uniqueSeats.size !== seats.length) {
    res.status(400).json({
      success: false,
      message: "Duplicate seats are not allowed",
    });
    return;
  }

  const pricedSeats = seats.map((id: string) => {
    const row = id.charAt(0);
    const number = Number(id.slice(1));

    const valid =
      /^[A-D][1-8]$/.test(id) &&
      (number - 1 + row.charCodeAt(0)) % 7 !== 0;

    if (!valid) return null;

    return {
      id,
      price:
        event.price +
        (row === "A"
          ? 40
          : row === "B"
            ? 20
            : 0),
    };
  });

  if (pricedSeats.some((seat) => seat === null)) {
    res.status(400).json({
      success: false,
      message: "Invalid or unavailable seats",
    });
    return;
  }

  const bookedSeatIds = new Set(
    getBookedSeatIds(eventId)
  );

  if (
    [...uniqueSeats].some((id) =>
      bookedSeatIds.has(id)
    )
  ) {
    res.status(409).json({
      success: false,
      message: "One or more seats are already booked",
    });
    return;
  }

  const confirmedSeats = pricedSeats.filter(
    (seat): seat is NonNullable<typeof seat> =>
      seat !== null
  );

  const totalPrice = confirmedSeats.reduce(
    (total, seat) => total + seat.price,
    0
  );

  // Identity comes from the verified session.
  const booking: Booking = {
    bookingId: `EVH-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`,
    eventId,
    seats: confirmedSeats,
    customerName: user.name,
    customerEmail: user.email,
    totalPrice,
    createdAt: new Date().toISOString(),
  };

  try {
    saveBooking(booking, user.userId);
  } catch (error) {
    console.error("Booking save failed:", error);

    if (
      error instanceof Error &&
      /UNIQUE constraint failed|PRIMARY KEY constraint failed/.test(
        error.message
      )
    ) {
      res.status(409).json({
        success: false,
        message: "One or more seats are already booked",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to save booking",
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: booking,
  });
});

// GET /api/bookings
router.get("/", (req, res) => {
  const user = (req as AuthenticatedRequest).authUser!;

  const bookings = getBookingsByUser(
    user.userId
  );

  res.json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

// GET /api/bookings/:bookingId
router.get("/:bookingId", (req, res) => {
  const user = (req as AuthenticatedRequest).authUser!;

  const booking = getBooking(
    String(req.params.bookingId),
    user.userId
  );

  if (!booking) {
    res.status(404).json({
      success: false,
      message: "Booking not found",
    });
    return;
  }

  res.json({
    success: true,
    data: booking,
  });
});

// DELETE /api/bookings/:bookingId
router.delete("/:bookingId", (req, res) => {
  const user = (req as AuthenticatedRequest).authUser!;

  const deleted = deleteBooking(
    String(req.params.bookingId),
    user.userId
  );

  if (!deleted) {
    res.status(404).json({
      success: false,
      message: "Booking not found",
    });
    return;
  }

  res.json({
    success: true,
    message: "Booking cancelled successfully",
  });
});

export default router;
