
ALTER TABLE booking_seats
ADD CONSTRAINT fk_booking_seat_inventory
FOREIGN KEY (event_id, seat_label)
REFERENCES event_seats(event_id, seat_label);
