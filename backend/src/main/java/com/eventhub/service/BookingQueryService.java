
package com.eventhub.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BookingQueryService {

    private final JdbcTemplate jdbcTemplate;

    public BookingQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> findBookingsByUserId(Long userId) {

        String sql = """
                SELECT
                    b.id AS booking_id,
                    b.status,
                    b.created_at,
                    e.id AS event_id,
                    e.title AS event_title,
                    e.city,
                    e.venue,
                    e.starts_at,
                    bs.seat_label,
                    bs.price_cents
                FROM bookings b
                JOIN events e ON e.id = b.event_id
                LEFT JOIN booking_seats bs ON bs.booking_id = b.id
                WHERE b.user_id = ?
                ORDER BY
                    b.created_at DESC,
                    b.id DESC,
                    bs.seat_label ASC
                """;

        Map<Long, Map<String, Object>> grouped = new LinkedHashMap<>();

        jdbcTemplate.query(sql, rs -> {
            addBookingRow(grouped, rs);
        }, userId);

        return new ArrayList<>(grouped.values());
    }

    // Fetch one booking belonging to the authenticated user.
    @Transactional(readOnly = true)
    public Map<String, Object> findBookingById(
            Long userId,
            Long bookingId) {

        String sql = """
                SELECT
                    b.id AS booking_id,
                    b.status,
                    b.created_at,
                    e.id AS event_id,
                    e.title AS event_title,
                    e.city,
                    e.venue,
                    e.starts_at,
                    bs.seat_label,
                    bs.price_cents
                FROM bookings b
                JOIN events e ON e.id = b.event_id
                LEFT JOIN booking_seats bs ON bs.booking_id = b.id
                WHERE b.user_id = ?
                  AND b.id = ?
                ORDER BY bs.seat_label ASC
                """;

        Map<Long, Map<String, Object>> grouped = new LinkedHashMap<>();

        jdbcTemplate.query(sql, rs -> {
            addBookingRow(grouped, rs);
        }, userId, bookingId);

        Map<String, Object> booking = grouped.get(bookingId);

        if (booking == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Booking not found"
            );
        }

        return booking;
    }

    private void addBookingRow(
            Map<Long, Map<String, Object>> grouped,
            java.sql.ResultSet rs) throws java.sql.SQLException {

        Long bookingId = rs.getLong("booking_id");

        Map<String, Object> booking = grouped.get(bookingId);

        if (booking == null) {
            booking = new LinkedHashMap<>();

            booking.put("bookingId", bookingId);
            booking.put("status", rs.getString("status"));
            booking.put(
                    "createdAt",
                    rs.getObject("created_at", OffsetDateTime.class)
            );

            booking.put("eventId", rs.getLong("event_id"));
            booking.put("eventTitle", rs.getString("event_title"));
            booking.put("city", rs.getString("city"));
            booking.put("venue", rs.getString("venue"));
            booking.put(
                    "startsAt",
                    rs.getObject("starts_at", OffsetDateTime.class)
            );

            booking.put(
                    "seats",
                    new ArrayList<Map<String, Object>>()
            );

            grouped.put(bookingId, booking);
        }

        String seatLabel = rs.getString("seat_label");

        if (seatLabel != null) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> seats =
                    (List<Map<String, Object>>) booking.get("seats");

            Map<String, Object> seat = new LinkedHashMap<>();

            seat.put("seatLabel", seatLabel);
            seat.put(
                    "priceCents",
                    (Integer) rs.getObject("price_cents")
            );

            seats.add(seat);
        }
    }
}
