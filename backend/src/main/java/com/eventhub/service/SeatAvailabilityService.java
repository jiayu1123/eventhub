package com.eventhub.service;

import com.eventhub.dto.SeatAvailabilityResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SeatAvailabilityService {

    private final JdbcTemplate jdbcTemplate;

    public SeatAvailabilityService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<SeatAvailabilityResponse> getSeats(Long eventId) {

        String sql = """
                SELECT
                    es.id,
                    es.event_id,
                    es.seat_label,
                    es.price_cents,
                    (ar.id IS NULL) AS available
                FROM event_seats es
                LEFT JOIN active_seat_reservations ar
                    ON ar.event_id = es.event_id
                    AND ar.seat_label = es.seat_label
                WHERE es.event_id = ?
                ORDER BY es.seat_label ASC
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new SeatAvailabilityResponse(
                        rs.getLong("id"),
                        rs.getLong("event_id"),
                        rs.getString("seat_label"),
                        rs.getInt("price_cents"),
                        rs.getBoolean("available")
                ),
                eventId
        );
    }
}
