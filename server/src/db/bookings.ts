
import { db } from "./database.js";
import type { Booking } from "../types/booking.js";

interface BookingRow {
  booking_id: string;
  event_id: number;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  total_price: number;
  created_at: string;
}

interface SeatRow {
  seat_id: string;
  price: number;
}

function mapBookingRow(row: BookingRow): Booking {
  const seats = db
    .prepare(`
      SELECT seat_id, price
      FROM booking_seats
      WHERE booking_id = ?
      ORDER BY seat_id
    `)
    .all(row.booking_id) as unknown as SeatRow[];

  return {
    bookingId: row.booking_id,
    eventId: row.event_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    totalPrice: row.total_price,
    createdAt: row.created_at,
    seats: seats.map((seat) => ({
      id: seat.seat_id,
      price: seat.price,
    })),
  };
}

// Save a booking owned by an authenticated user.
export function saveBooking(
  booking: Booking,
  userId: string
): void {
  db.exec("BEGIN IMMEDIATE");

  try {
    db.prepare(`
      INSERT INTO bookings (
        booking_id,
        event_id,
        user_id,
        customer_name,
        customer_email,
        total_price,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      booking.bookingId,
      booking.eventId,
      userId,
      booking.customerName,
      booking.customerEmail,
      booking.totalPrice,
      booking.createdAt
    );

    const insertSeat = db.prepare(`
      INSERT INTO booking_seats (
        booking_id,
        event_id,
        seat_id,
        price
      )
      VALUES (?, ?, ?, ?)
    `);

    for (const seat of booking.seats) {
      insertSeat.run(
        booking.bookingId,
        booking.eventId,
        seat.id,
        seat.price
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Return a booking only when owned by this user.
export function getBooking(
  bookingId: string,
  userId: string
): Booking | null {
  const row = db
    .prepare(`
      SELECT *
      FROM bookings
      WHERE booking_id = ?
        AND user_id = ?
    `)
    .get(bookingId, userId) as unknown as
    | BookingRow
    | undefined;

  return row ? mapBookingRow(row) : null;
}

// Return all bookings owned by this user.
export function getBookingsByUser(
  userId: string
): Booking[] {
  const rows = db
    .prepare(`
      SELECT *
      FROM bookings
      WHERE user_id = ?
      ORDER BY created_at DESC, booking_id DESC
    `)
    .all(userId) as unknown as BookingRow[];

  return rows.map(mapBookingRow);
}

// Reserved seats remain global across all users.
export function getBookedSeatIds(
  eventId: number
): string[] {
  const rows = db
    .prepare(`
      SELECT seat_id
      FROM booking_seats
      WHERE event_id = ?
    `)
    .all(eventId) as unknown as {
    seat_id: string;
  }[];

  return rows.map((row) => row.seat_id);
}

// Cancel only an order owned by this user.
export function deleteBooking(
  bookingId: string,
  userId: string
): boolean {
  const result = db
    .prepare(`
      DELETE FROM bookings
      WHERE booking_id = ?
        AND user_id = ?
    `)
    .run(bookingId, userId);

  return result.changes > 0;
}
