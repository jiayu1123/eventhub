
CREATE TABLE event_seats (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id),
    seat_label VARCHAR(20) NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    CONSTRAINT unique_event_seat_inventory
        UNIQUE (event_id, seat_label)
);

CREATE INDEX idx_event_seats_event_id
    ON event_seats(event_id);
