
-- V4: Preserve booking history while allowing cancelled seats
-- to become available for new reservations.

-- 1. Store the ticket price at booking time.
ALTER TABLE booking_seats
ADD COLUMN price_cents INTEGER;

-- 2. Backfill prices for existing historical bookings.
UPDATE booking_seats bs
SET price_cents = es.price_cents
FROM event_seats es
WHERE bs.event_id = es.event_id
  AND bs.seat_label = es.seat_label;

-- Existing rows have no historical price snapshot.
-- The current inventory price is the best available backfill.
ALTER TABLE booking_seats
ALTER COLUMN price_cents SET NOT NULL;

ALTER TABLE booking_seats
ADD CONSTRAINT booking_seats_price_check
CHECK (price_cents >= 0);

-- 3. Create a table for active seat reservations.
CREATE TABLE active_seat_reservations (
    id BIGSERIAL PRIMARY KEY,

    booking_id BIGINT NOT NULL
        REFERENCES bookings(id),

    event_id BIGINT NOT NULL,

    seat_label VARCHAR(20) NOT NULL,

    CONSTRAINT unique_active_event_seat
        UNIQUE (event_id, seat_label),

    CONSTRAINT unique_active_booking_seat
        UNIQUE (booking_id, seat_label),

    CONSTRAINT fk_active_seat_inventory
        FOREIGN KEY (event_id, seat_label)
        REFERENCES event_seats(event_id, seat_label)
);

-- 4. Migrate currently confirmed bookings into the active table.
INSERT INTO active_seat_reservations (
    booking_id,
    event_id,
    seat_label
)
SELECT
    bs.booking_id,
    bs.event_id,
    bs.seat_label
FROM booking_seats bs
JOIN bookings b ON b.id = bs.booking_id
WHERE b.status = 'CONFIRMED';

-- 5. Remove the old uniqueness constraint from booking history.
-- Historical bookings may now contain the same event and seat.
ALTER TABLE booking_seats
DROP CONSTRAINT unique_event_seat;

-- 6. Add indexes for booking history and active reservations.
CREATE INDEX idx_booking_seats_booking_id
ON booking_seats(booking_id);

CREATE INDEX idx_active_reservations_booking_id
ON active_seat_reservations(booking_id);

CREATE INDEX idx_active_reservations_event_id
ON active_seat_reservations(event_id);
