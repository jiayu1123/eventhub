-- Fictional demo events for the EventHub portfolio project.
-- All event times are UTC.

INSERT INTO events (title, city, venue, starts_at, price_cents)
VALUES
  ('Boston Live Music Night', 'Boston', 'EventHub Demo Music Hall',
   '2026-11-21 19:00:00+00', 6500),
  ('Boston Tech Networking Meetup', 'Boston', 'EventHub Demo Conference Center',
   '2026-12-05 18:00:00+00', 2500),
  ('Boston Basketball Showcase', 'Boston', 'EventHub Demo Arena',
   '2026-12-12 20:00:00+00', 8500),
  ('Boston Food Festival', 'Boston', 'EventHub Demo Food Hall',
   '2027-01-09 17:00:00+00', 3500),
  ('Boston Comedy Night', 'Boston', 'EventHub Demo Comedy Club',
   '2027-01-23 19:30:00+00', 4500),
  ('Boston Art and Design Expo', 'Boston', 'EventHub Demo Gallery',
   '2027-02-06 15:00:00+00', 2000),

  ('New York Jazz Evening', 'New York', 'EventHub Demo Jazz Club',
   '2026-12-19 19:30:00+00', 7500),
  ('New York Startup Summit', 'New York', 'EventHub Demo Startup Center',
   '2027-01-16 14:00:00+00', 12000),
  ('New York Photography Walk', 'New York', 'EventHub Demo Photography Studio',
   '2027-02-13 13:00:00+00', 3000),
  ('New York Indie Music Festival', 'New York', 'EventHub Demo Indie Stage',
   '2027-03-06 19:00:00+00', 9000),

  ('Chicago Winter Music Festival', 'Chicago', 'EventHub Demo Festival Hall',
   '2027-01-16 18:00:00+00', 9500),
  ('Chicago Developer Conference', 'Chicago', 'EventHub Demo Tech Center',
   '2027-02-20 13:00:00+00', 15000),
  ('Chicago Street Food Experience', 'Chicago', 'EventHub Demo Food Market',
   '2027-03-13 16:00:00+00', 2500),
  ('Chicago Sports Fan Meetup', 'Chicago', 'EventHub Demo Sports Lounge',
   '2027-03-27 18:00:00+00', 1500),

  ('Seattle Developer Meetup', 'Seattle', 'EventHub Demo Innovation Hub',
   '2027-01-30 18:00:00+00', 2000),
  ('Seattle Acoustic Music Night', 'Seattle', 'EventHub Demo Acoustic Hall',
   '2027-02-27 20:00:00+00', 5500),
  ('Seattle Coffee and Culture Expo', 'Seattle', 'EventHub Demo Coffee Center',
   '2027-03-20 14:00:00+00', 3000),

  ('San Francisco AI Conference', 'San Francisco', 'EventHub Demo AI Center',
   '2027-02-13 13:00:00+00', 15000),
  ('San Francisco Product Design Workshop', 'San Francisco', 'EventHub Demo Design Studio',
   '2027-03-13 15:00:00+00', 6500),
  ('San Francisco Tech Community Night', 'San Francisco', 'EventHub Demo Community Hub',
   '2027-04-10 19:00:00+00', 3500);

-- Create 20 seats for each newly seeded demo event.
-- Uses the venue prefix to identify fictional demo events.

INSERT INTO event_seats (event_id, seat_label, price_cents)
SELECT
    e.id,
    seat.row_label || seat.seat_number,
    e.price_cents
FROM events e
CROSS JOIN (
    SELECT row_label, seat_number
    FROM (VALUES ('A'), ('B')) AS rows(row_label)
    CROSS JOIN generate_series(1, 10) AS numbers(seat_number)
) AS seat
WHERE e.venue LIKE 'EventHub Demo %';
