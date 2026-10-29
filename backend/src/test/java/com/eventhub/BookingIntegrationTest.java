package com.eventhub;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.eventhub.dto.SeatAvailabilityResponse;
import com.eventhub.service.SeatAvailabilityService;
import com.eventhub.entity.Booking;
import com.eventhub.service.BookingService;
import com.eventhub.service.BookingQueryService;
import com.eventhub.service.BookingCancellationService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;

import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Testcontainers
class BookingIntegrationTest {

        @Container
        static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
                        .withDatabaseName("eventhub_test")
                        .withUsername("test")
                        .withPassword("test");

        @DynamicPropertySource
        static void configureDatabase(DynamicPropertyRegistry registry) {
                registry.add("spring.datasource.url", postgres::getJdbcUrl);
                registry.add("spring.datasource.username", postgres::getUsername);
                registry.add("spring.datasource.password", postgres::getPassword);
        }

        @Autowired
        private BookingService bookingService;

        @Autowired
        private BookingQueryService bookingQueryService;

        @Autowired
        private BookingCancellationService bookingCancellationService;

        @Autowired
        private JdbcTemplate jdbcTemplate;

        @Autowired
        private SeatAvailabilityService seatAvailabilityService;

        @Value("${local.server.port}")
        private int port;

        private record CsrfSession(
                        String headerName,
                        String token,
                        String cookie) {
        }

        private CsrfSession fetchCsrfSession(
                        HttpClient client,
                        String baseUrl) throws Exception {

                HttpRequest request = HttpRequest.newBuilder()
                                .uri(URI.create(baseUrl + "/api/auth/csrf"))
                                .GET()
                                .build();

                HttpResponse<String> response = client.send(
                                request,
                                HttpResponse.BodyHandlers.ofString());

                assertEquals(200, response.statusCode(), response.body());

                ObjectMapper mapper = new ObjectMapper();
                JsonNode body = mapper.readTree(response.body());

                String headerName = body.get("headerName").asText();
                String token = body.get("token").asText();

                String cookie = response.headers()
                                .allValues("Set-Cookie")
                                .stream()
                                .map(value -> value.split(";", 2)[0])
                                .filter(value -> value.startsWith("XSRF-TOKEN="))
                                .findFirst()
                                .orElseThrow(() -> new AssertionError(
                                                "Missing XSRF-TOKEN cookie"));

                return new CsrfSession(headerName, token, cookie);
        }

        private Long createUser() {
                String email = "test-" + UUID.randomUUID() + "@example.com";

                return jdbcTemplate.queryForObject(
                                """
                                                INSERT INTO users (email, password_hash)
                                                VALUES (?, ?)
                                                RETURNING id
                                                """,
                                Long.class,
                                email,
                                "test-password-hash");
        }

        private Long createEventWithSeat() {
                Long eventId = jdbcTemplate.queryForObject(
                                """
                                                INSERT INTO events
                                                    (title, city, venue, starts_at, price_cents)
                                                VALUES
                                                    (?, ?, ?, NOW() + INTERVAL '30 days', ?)
                                                RETURNING id
                                                """,
                                Long.class,
                                "Integration Test Concert",
                                "Boston",
                                "Test Arena",
                                10000);

                jdbcTemplate.update(
                                """
                                                INSERT INTO event_seats
                                                    (event_id, seat_label, price_cents)
                                                VALUES (?, ?, ?)
                                                """,
                                eventId,
                                "A1",
                                10000);

                return eventId;
        }

        // Create a dedicated event with three seats for multi-seat tests.
        private Long createEventWithMultipleSeats() {
                Long eventId = createEventWithSeat();
                jdbcTemplate.update(
                                """
                                                INSERT INTO event_seats (event_id, seat_label, price_cents)
                                                VALUES (?, 'A2', 12000), (?, 'A3', 15000)
                                                """,
                                eventId, eventId);
                return eventId;
        }

        // 1. Create booking successfully
        @Test
        void shouldCreateBookingSuccessfully() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                assertNotNull(booking.getId());
                assertEquals("CONFIRMED", booking.getStatus());

                Integer seatCount = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM active_seat_reservations
                                                WHERE event_id = ? AND seat_label = ?
                                                """,
                                Integer.class,
                                eventId,
                                "A1");

                assertEquals(1, seatCount);
        }

        // 2. Reject duplicate seat booking
        @Test
        void shouldRejectDuplicateSeatBooking() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                bookingService.createBooking(userId, eventId, "A1");

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingService.createBooking(
                                                userId, eventId, "A1"));

                assertEquals(
                                HttpStatus.CONFLICT,
                                exception.getStatusCode());

                Integer seatCount = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM active_seat_reservations
                                                WHERE event_id = ? AND seat_label = ?
                                                """,
                                Integer.class,
                                eventId,
                                "A1");

                assertEquals(1, seatCount);
        }

        // 3. Prevent concurrent double booking
        @Test
        void shouldPreventConcurrentDoubleBooking() throws Exception {
                Long userA = createUser();
                Long userB = createUser();
                Long eventId = createEventWithSeat();

                ExecutorService executor = Executors.newFixedThreadPool(2);
                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch start = new CountDownLatch(1);

                try {
                        java.util.concurrent.Callable<Integer> bookA = () -> {
                                ready.countDown();
                                start.await();

                                try {
                                        bookingService.createBooking(userA, eventId, "A1");
                                        return 201;
                                } catch (ResponseStatusException ex) {
                                        return ex.getStatusCode().value();
                                }
                        };

                        java.util.concurrent.Callable<Integer> bookB = () -> {
                                ready.countDown();
                                start.await();

                                try {
                                        bookingService.createBooking(userB, eventId, "A1");
                                        return 201;
                                } catch (ResponseStatusException ex) {
                                        return ex.getStatusCode().value();
                                }
                        };

                        var futureA = executor.submit(bookA);
                        var futureB = executor.submit(bookB);

                        assertTrue(ready.await(10, TimeUnit.SECONDS));
                        start.countDown();

                        int resultA = futureA.get(20, TimeUnit.SECONDS);
                        int resultB = futureB.get(20, TimeUnit.SECONDS);

                        List<Integer> results = List.of(resultA, resultB);

                        assertEquals(
                                        1,
                                        results.stream().filter(r -> r == 201).count());

                        assertEquals(
                                        1,
                                        results.stream().filter(r -> r == 409).count());

                        Integer seatCount = jdbcTemplate.queryForObject(
                                        """
                                                        SELECT COUNT(*)
                                                        FROM active_seat_reservations
                                                        WHERE event_id = ? AND seat_label = ?
                                                        """,
                                        Integer.class,
                                        eventId,
                                        "A1");

                        assertEquals(1, seatCount);

                } finally {
                        start.countDown();
                        executor.shutdownNow();
                }
        }

        // 4. My Tickets returns full booking details
        @Test
        void shouldReturnBookingDetails() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                List<Map<String, Object>> results = bookingQueryService.findBookingsByUserId(userId);

                assertEquals(1, results.size());

                Map<String, Object> result = results.get(0);

                assertEquals(booking.getId(), result.get("bookingId"));
                assertEquals("CONFIRMED", result.get("status"));
                assertEquals(eventId, result.get("eventId"));
                assertEquals(
                                "Integration Test Concert",
                                result.get("eventTitle"));
                assertEquals("Boston", result.get("city"));
                assertEquals("Test Arena", result.get("venue"));

                assertNotNull(result.get("createdAt"));
                assertNotNull(result.get("startsAt"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> seats = (List<Map<String, Object>>) result.get("seats");

                assertEquals(1, seats.size());
                assertEquals("A1", seats.get(0).get("seatLabel"));
                assertEquals(10000, seats.get(0).get("priceCents"));
        }

        // 5. My Tickets isolates user bookings
        @Test
        void shouldOnlyReturnCurrentUserBookings() {
                Long userA = createUser();
                Long userB = createUser();
                Long eventId = createEventWithSeat();

                bookingService.createBooking(userA, eventId, "A1");

                List<Map<String, Object>> bookingsA = bookingQueryService.findBookingsByUserId(userA);

                List<Map<String, Object>> bookingsB = bookingQueryService.findBookingsByUserId(userB);

                assertEquals(1, bookingsA.size());
                assertTrue(bookingsB.isEmpty());
        }

        // 6. My Tickets returns an empty list for new users
        @Test
        void shouldReturnEmptyBookingsForNewUser() {
                Long userId = createUser();

                List<Map<String, Object>> results = bookingQueryService.findBookingsByUserId(userId);

                assertNotNull(results);
                assertTrue(results.isEmpty());
        }

        // 7. Unauthenticated My Tickets requests are rejected
        @Test
        void shouldRejectUnauthenticatedMyTicketsRequest()
                        throws Exception {

                try (HttpClient client = HttpClient.newHttpClient()) {
                        HttpRequest request = HttpRequest.newBuilder()
                                        .uri(URI.create(
                                                        "http://localhost:" + port + "/api/bookings/me"))
                                        .GET()
                                        .build();

                        HttpResponse<String> response = client.send(
                                        request,
                                        HttpResponse.BodyHandlers.ofString());

                        assertEquals(
                                        401,
                                        response.statusCode(),
                                        "Unauthenticated users should not access My Tickets");
                }
        }

        // 8. Cancel booking successfully and release seat
        @Test
        void shouldCancelBookingSuccessfully() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                Booking cancelled = bookingCancellationService.cancelBooking(
                                userId, booking.getId());

                assertEquals("CANCELLED", cancelled.getStatus());

                String status = jdbcTemplate.queryForObject(
                                "SELECT status FROM bookings WHERE id = ?",
                                String.class,
                                booking.getId());

                assertEquals("CANCELLED", status);

                Integer remainingSeats = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE booking_id = ?",
                                Integer.class,
                                booking.getId());

                assertEquals(0, remainingSeats);

                Integer historyCount = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM booking_seats WHERE booking_id = ?",
                                Integer.class,
                                booking.getId());

                assertEquals(1, historyCount);
        }

        // 9. Reject cancellation by another user
        @Test
        void shouldRejectCancellingAnotherUsersBooking() {
                Long ownerId = createUser();
                Long otherUserId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                ownerId, eventId, "A1");

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingCancellationService.cancelBooking(
                                                otherUserId, booking.getId()));

                assertEquals(
                                HttpStatus.FORBIDDEN,
                                exception.getStatusCode());

                String status = jdbcTemplate.queryForObject(
                                "SELECT status FROM bookings WHERE id = ?",
                                String.class,
                                booking.getId());

                assertEquals("CONFIRMED", status);
        }

        // 10. Reject cancellation of nonexistent booking
        @Test
        void shouldRejectCancellingNonexistentBooking() {
                Long userId = createUser();

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingCancellationService.cancelBooking(
                                                userId, -1L));

                assertEquals(
                                HttpStatus.NOT_FOUND,
                                exception.getStatusCode());
        }

        // 11. Reject repeated cancellation
        @Test
        void shouldRejectRepeatedCancellation() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                bookingCancellationService.cancelBooking(
                                userId, booking.getId());

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingCancellationService.cancelBooking(
                                                userId, booking.getId()));

                assertEquals(
                                HttpStatus.CONFLICT,
                                exception.getStatusCode());
        }

        // 12. Allow rebooking after cancellation
        @Test
        void shouldAllowSeatRebookingAfterCancellation() {
                Long firstUserId = createUser();
                Long secondUserId = createUser();
                Long eventId = createEventWithSeat();

                Booking firstBooking = bookingService.createBooking(
                                firstUserId, eventId, "A1");

                bookingCancellationService.cancelBooking(
                                firstUserId, firstBooking.getId());

                Booking secondBooking = bookingService.createBooking(
                                secondUserId, eventId, "A1");

                assertNotNull(secondBooking.getId());
                assertEquals("CONFIRMED", secondBooking.getStatus());

                Integer seatCount = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM active_seat_reservations
                                                WHERE event_id = ? AND seat_label = ?
                                                """,
                                Integer.class,
                                eventId,
                                "A1");

                assertEquals(1, seatCount);
        }

        @Test
        void shouldPreventConcurrentDoubleCancellation() throws Exception {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                ExecutorService executor = Executors.newFixedThreadPool(2);
                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch start = new CountDownLatch(1);

                try {
                        java.util.concurrent.Callable<Integer> cancel = () -> {
                                ready.countDown();
                                start.await();

                                try {
                                        bookingCancellationService.cancelBooking(
                                                        userId, booking.getId());
                                        return 200;
                                } catch (ResponseStatusException ex) {
                                        return ex.getStatusCode().value();
                                }
                        };

                        var futureA = executor.submit(cancel);
                        var futureB = executor.submit(cancel);

                        assertTrue(ready.await(10, TimeUnit.SECONDS));
                        start.countDown();

                        int resultA = futureA.get(20, TimeUnit.SECONDS);
                        int resultB = futureB.get(20, TimeUnit.SECONDS);

                        List<Integer> results = List.of(resultA, resultB);

                        assertEquals(
                                        1,
                                        results.stream().filter(r -> r == 200).count());

                        assertEquals(
                                        1,
                                        results.stream().filter(r -> r == 409).count());

                        String status = jdbcTemplate.queryForObject(
                                        "SELECT status FROM bookings WHERE id = ?",
                                        String.class,
                                        booking.getId());

                        assertEquals("CANCELLED", status);

                        Integer remainingSeats = jdbcTemplate.queryForObject(
                                        """
                                                        SELECT COUNT(*)
                                                        FROM active_seat_reservations
                                                        WHERE booking_id = ?
                                                        """,
                                        Integer.class,
                                        booking.getId());

                        assertEquals(0, remainingSeats);

                        Integer historyCount = jdbcTemplate.queryForObject(
                                        "SELECT COUNT(*) FROM booking_seats WHERE booking_id = ?",
                                        Integer.class,
                                        booking.getId());

                        assertEquals(1, historyCount);

                } finally {
                        start.countDown();
                        executor.shutdownNow();
                }
        }

        // 15. Cancelled bookings preserve seat and purchase price in My Tickets
        @Test
        void shouldPreserveBookingHistoryAfterCancellation() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(userId, eventId, "A1");
                bookingCancellationService.cancelBooking(userId, booking.getId());

                List<Map<String, Object>> bookings = bookingQueryService.findBookingsByUserId(userId);
                assertEquals(1, bookings.size());
                Map<String, Object> result = bookings.get(0);
                assertEquals(booking.getId(), result.get("bookingId"));
                assertEquals("CANCELLED", result.get("status"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> seats = (List<Map<String, Object>>) result.get("seats");
                assertEquals(1, seats.size());
                assertEquals("A1", seats.get(0).get("seatLabel"));
                assertEquals(10000, seats.get(0).get("priceCents"));

                Integer activeCount = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE booking_id = ?",
                                Integer.class, booking.getId());
                assertEquals(0, activeCount);
        }

        // 16. Ticket purchase price remains unchanged if inventory price changes
        @Test
        void shouldPreserveOriginalPriceAfterInventoryPriceChange() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();
                Booking booking = bookingService.createBooking(userId, eventId, "A1");

                jdbcTemplate.update(
                                "UPDATE event_seats SET price_cents = ? WHERE event_id = ? AND seat_label = ?",
                                15000, eventId, "A1");

                List<Map<String, Object>> bookings = bookingQueryService.findBookingsByUserId(userId);
                assertEquals(1, bookings.size());
                assertEquals(booking.getId(), bookings.get(0).get("bookingId"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> seats = (List<Map<String, Object>>) bookings.get(0).get("seats");
                assertEquals(1, seats.size());
                assertEquals(10000, seats.get(0).get("priceCents"));

                Integer storedPrice = jdbcTemplate.queryForObject(
                                "SELECT price_cents FROM booking_seats WHERE booking_id = ?",
                                Integer.class, booking.getId());
                assertEquals(10000, storedPrice);
        }

        // 16. Newly created seats are available
        @Test
        void shouldShowNewSeatAsAvailable() {
                Long eventId = createEventWithSeat();
                List<SeatAvailabilityResponse> seats = seatAvailabilityService.getSeats(eventId);

                assertEquals(1, seats.size());
                assertEquals(eventId, seats.get(0).eventId());
                assertEquals("A1", seats.get(0).seatLabel());
                assertEquals(10000, seats.get(0).priceCents());
                assertTrue(seats.get(0).available());
        }

        // 17. Confirmed booking makes seat unavailable
        @Test
        void shouldShowBookedSeatAsUnavailable() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();
                bookingService.createBooking(userId, eventId, "A1");

                List<SeatAvailabilityResponse> seats = seatAvailabilityService.getSeats(eventId);
                assertEquals(1, seats.size());
                assertFalse(seats.get(0).available());
        }

        // 18. Cancelling a booking releases the seat
        @Test
        void shouldShowSeatAsAvailableAfterCancellation() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();
                Booking booking = bookingService.createBooking(userId, eventId, "A1");
                assertFalse(seatAvailabilityService.getSeats(eventId).get(0).available());

                bookingCancellationService.cancelBooking(userId, booking.getId());

                assertTrue(seatAvailabilityService.getSeats(eventId).get(0).available());
        }

        // 19. Rebooking the released seat makes it unavailable again
        @Test
        void shouldShowSeatAsUnavailableAfterRebooking() {
                Long userA = createUser();
                Long userB = createUser();
                Long eventId = createEventWithSeat();
                Booking original = bookingService.createBooking(userA, eventId, "A1");
                bookingCancellationService.cancelBooking(userA, original.getId());
                assertTrue(seatAvailabilityService.getSeats(eventId).get(0).available());

                bookingService.createBooking(userB, eventId, "A1");

                assertFalse(seatAvailabilityService.getSeats(eventId).get(0).available());
        }

        // 20. Missing events return HTTP 404 from the public seats endpoint
        @Test
        void shouldReturn404ForNonexistentEventSeats() throws Exception {
                try (HttpClient client = HttpClient.newHttpClient()) {
                        HttpRequest request = HttpRequest.newBuilder()
                                        .uri(URI.create("http://localhost:" + port + "/api/events/-1/seats"))
                                        .GET()
                                        .build();
                        HttpResponse<String> response = client.send(
                                        request, HttpResponse.BodyHandlers.ofString());
                        assertEquals(404, response.statusCode());
                }
        }

        // Multi-seat: one booking reserves two seats with their original prices.
        @Test
        void shouldCreateMultiSeatBookingSuccessfully() {
                Long userId = createUser();
                Long eventId = createEventWithMultipleSeats();

                Booking booking = bookingService.createBooking(userId, eventId, List.of("A1", "A2"));

                assertNotNull(booking.getId());
                assertEquals("CONFIRMED", booking.getStatus());

                Integer activeCount = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE booking_id = ?",
                                Integer.class, booking.getId());
                assertEquals(2, activeCount);

                List<Map<String, Object>> history = bookingQueryService.findBookingsByUserId(userId);
                assertEquals(1, history.size());
                assertEquals(booking.getId(), history.get(0).get("bookingId"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> bookedSeats = (List<Map<String, Object>>) history.get(0).get("seats");
                assertEquals(2, bookedSeats.size());
                assertEquals(List.of("A1", "A2"),
                                bookedSeats.stream().map(seat -> (String) seat.get("seatLabel")).toList());
                assertEquals(22000, bookedSeats.stream()
                                .mapToInt(seat -> ((Number) seat.get("priceCents")).intValue()).sum());
        }

        // Multi-seat: a request cannot contain the same seat twice.
        @Test
        void shouldRejectDuplicateSeatsInSameRequest() {
                Long userId = createUser();
                Long eventId = createEventWithMultipleSeats();

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingService.createBooking(userId, eventId, List.of("A1", "A1")));
                assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());

                Integer bookingCount = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND event_id = ?",
                                Integer.class, userId, eventId);
                assertEquals(0, bookingCount);
        }

        // Multi-seat: a known conflict rejects the entire request.
        @Test
        void shouldRejectEntireMultiSeatBookingWhenOneSeatUnavailable() {
                Long firstUser = createUser();
                Long secondUser = createUser();
                Long eventId = createEventWithMultipleSeats();
                bookingService.createBooking(firstUser, eventId, List.of("A2"));

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingService.createBooking(secondUser, eventId, List.of("A1", "A2")));
                assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());

                Integer secondUserBookings = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND event_id = ?",
                                Integer.class, secondUser, eventId);
                assertEquals(0, secondUserBookings);

                Integer a1Reservations = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE event_id = ? AND seat_label = 'A1'",
                                Integer.class, eventId);
                assertEquals(0, a1Reservations);

                Integer a2Reservations = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE event_id = ? AND seat_label = 'A2'",
                                Integer.class, eventId);
                assertEquals(1, a2Reservations);
        }

        // Multi-seat: cancelling releases every seat but preserves booking history.
        @Test
        void shouldCancelMultiSeatBookingAndAllowRebooking() {
                Long firstUser = createUser();
                Long secondUser = createUser();
                Long eventId = createEventWithMultipleSeats();

                Booking original = bookingService.createBooking(firstUser, eventId, List.of("A1", "A2"));
                Booking cancelled = bookingCancellationService.cancelBooking(firstUser, original.getId());
                assertEquals("CANCELLED", cancelled.getStatus());

                Integer remainingReservations = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE booking_id = ?",
                                Integer.class, original.getId());
                assertEquals(0, remainingReservations);

                Booking rebooked = bookingService.createBooking(secondUser, eventId, List.of("A1", "A2"));
                assertNotNull(rebooked.getId());
                assertNotEquals(original.getId(), rebooked.getId());

                Integer newReservations = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM active_seat_reservations WHERE booking_id = ?",
                                Integer.class, rebooked.getId());
                assertEquals(2, newReservations);

                List<Map<String, Object>> oldHistory = bookingQueryService.findBookingsByUserId(firstUser);
                assertEquals(1, oldHistory.size());
                assertEquals("CANCELLED", oldHistory.get(0).get("status"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> oldSeats = (List<Map<String, Object>>) oldHistory.get(0).get("seats");
                assertEquals(2, oldSeats.size());
        }

        // Concurrent multi-seat requests sharing A2: exactly one succeeds.
        @Test
        void shouldPreventConcurrentOverlappingMultiSeatBookings() throws Exception {
                Long userA = createUser();
                Long userB = createUser();
                Long eventId = createEventWithMultipleSeats();

                ExecutorService executor = Executors.newFixedThreadPool(2);
                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch start = new CountDownLatch(1);

                try {
                        java.util.concurrent.Callable<Integer> bookA = () -> {
                                ready.countDown();
                                if (!start.await(10, TimeUnit.SECONDS)) {
                                        throw new IllegalStateException("Timed out waiting to start booking A");
                                }
                                try {
                                        bookingService.createBooking(userA, eventId, List.of("A1", "A2"));
                                        return 201;
                                } catch (ResponseStatusException ex) {
                                        return ex.getStatusCode().value();
                                }
                        };

                        java.util.concurrent.Callable<Integer> bookB = () -> {
                                ready.countDown();
                                if (!start.await(10, TimeUnit.SECONDS)) {
                                        throw new IllegalStateException("Timed out waiting to start booking B");
                                }
                                try {
                                        bookingService.createBooking(userB, eventId, List.of("A2", "A3"));
                                        return 201;
                                } catch (ResponseStatusException ex) {
                                        return ex.getStatusCode().value();
                                }
                        };

                        var futureA = executor.submit(bookA);
                        var futureB = executor.submit(bookB);
                        assertTrue(ready.await(10, TimeUnit.SECONDS));
                        start.countDown();

                        int resultA = futureA.get(20, TimeUnit.SECONDS);
                        int resultB = futureB.get(20, TimeUnit.SECONDS);

                        assertEquals(1, List.of(resultA, resultB).stream().filter(r -> r == 201).count());
                        assertEquals(1, List.of(resultA, resultB).stream().filter(r -> r == 409).count());

                        // The winner has exactly one booking and both seats; the loser has none.
                        Long winnerId = resultA == 201 ? userA : userB;
                        Long loserId = resultA == 201 ? userB : userA;
                        List<String> expectedSeats = resultA == 201
                                        ? List.of("A1", "A2")
                                        : List.of("A2", "A3");

                        Integer winnerBookings = jdbcTemplate.queryForObject(
                                        "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND event_id = ?",
                                        Integer.class, winnerId, eventId);
                        Integer loserBookings = jdbcTemplate.queryForObject(
                                        "SELECT COUNT(*) FROM bookings WHERE user_id = ? AND event_id = ?",
                                        Integer.class, loserId, eventId);
                        assertEquals(1, winnerBookings);
                        assertEquals(0, loserBookings);

                        List<String> reservedSeats = jdbcTemplate.queryForList(
                                        "SELECT seat_label FROM active_seat_reservations WHERE event_id = ? ORDER BY seat_label",
                                        String.class, eventId);
                        assertEquals(expectedSeats, reservedSeats);

                        Integer historySeatCount = jdbcTemplate.queryForObject(
                                        """
                                                        SELECT COUNT(*) FROM booking_seats bs
                                                        JOIN bookings b ON b.id = bs.booking_id
                                                        WHERE b.user_id = ? AND b.event_id = ?
                                                        """,
                                        Integer.class, winnerId, eventId);
                        assertEquals(2, historySeatCount);
                } finally {
                        start.countDown();
                        executor.shutdownNow();
                }
        }

        // Booking detail: owner can retrieve a confirmed booking.
        @Test
        void shouldReturnBookingByIdForOwner() {
                Long userId = createUser();
                Long eventId = createEventWithMultipleSeats();

                Booking booking = bookingService.createBooking(
                                userId, eventId, List.of("A1", "A2"));

                Map<String, Object> result = bookingQueryService.findBookingById(
                                userId, booking.getId());

                assertEquals(booking.getId(), result.get("bookingId"));
                assertEquals("CONFIRMED", result.get("status"));
                assertEquals(eventId, result.get("eventId"));
                assertEquals(
                                "Integration Test Concert",
                                result.get("eventTitle"));
                assertEquals("Boston", result.get("city"));
                assertEquals("Test Arena", result.get("venue"));

                assertNotNull(result.get("createdAt"));
                assertNotNull(result.get("startsAt"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> seats = (List<Map<String, Object>>) result.get("seats");

                assertEquals(2, seats.size());
                assertEquals("A1", seats.get(0).get("seatLabel"));
                assertEquals("A2", seats.get(1).get("seatLabel"));

                assertEquals(22000, seats.stream()
                                .mapToInt(seat -> ((Number) seat.get("priceCents")).intValue())
                                .sum());
        }

        // Booking detail: another user cannot view the booking.
        @Test
        void shouldRejectViewingAnotherUsersBooking() {
                Long ownerId = createUser();
                Long otherUserId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                ownerId, eventId, "A1");

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingQueryService.findBookingById(
                                                otherUserId, booking.getId()));

                assertEquals(
                                HttpStatus.NOT_FOUND,
                                exception.getStatusCode());
        }

        // Booking detail: nonexistent booking returns 404.
        @Test
        void shouldReturn404ForNonexistentBookingDetail() {
                Long userId = createUser();

                ResponseStatusException exception = assertThrows(
                                ResponseStatusException.class,
                                () -> bookingQueryService.findBookingById(
                                                userId, -1L));

                assertEquals(
                                HttpStatus.NOT_FOUND,
                                exception.getStatusCode());
        }

        // Booking detail: cancelled booking preserves its history.
        @Test
        void shouldReturnCancelledBookingById() {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                bookingCancellationService.cancelBooking(
                                userId, booking.getId());

                Map<String, Object> result = bookingQueryService.findBookingById(
                                userId, booking.getId());

                assertEquals(booking.getId(), result.get("bookingId"));
                assertEquals("CANCELLED", result.get("status"));

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> seats = (List<Map<String, Object>>) result.get("seats");

                assertEquals(1, seats.size());
                assertEquals("A1", seats.get(0).get("seatLabel"));
                assertEquals(10000, seats.get(0).get("priceCents"));

                Integer activeReservations = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM active_seat_reservations
                                                WHERE booking_id = ?
                                                """,
                                Integer.class,
                                booking.getId());

                assertEquals(0, activeReservations);
        }

        // Booking detail API: unauthenticated requests must return 401.
        @Test
        void shouldRejectUnauthenticatedBookingDetailRequest() throws Exception {
                Long userId = createUser();
                Long eventId = createEventWithSeat();

                Booking booking = bookingService.createBooking(
                                userId, eventId, "A1");

                try (HttpClient client = HttpClient.newHttpClient()) {
                        HttpRequest request = HttpRequest.newBuilder()
                                        .uri(URI.create(
                                                        "http://localhost:" + port
                                                                        + "/api/bookings/" + booking.getId()))
                                        .GET()
                                        .build();

                        HttpResponse<String> response = client.send(
                                        request,
                                        HttpResponse.BodyHandlers.ofString());

                        assertEquals(
                                        401,
                                        response.statusCode(),
                                        "Unauthenticated users must not access booking details");
                }
        }


    // Booking detail API: enforce ownership using real HTTP sessions.
    @Test
    void shouldEnforceBookingOwnershipThroughHttpApi() throws Exception {
        String emailA = "owner-" + UUID.randomUUID() + "@example.com";
        String emailB = "other-" + UUID.randomUUID() + "@example.com";
        String password = "TestPassword123!";
        String baseUrl = "http://localhost:" + port;

        try (HttpClient client = HttpClient.newHttpClient()) {

            // 1. Obtain a CSRF token for registration.
            CsrfSession csrf = fetchCsrfSession(client, baseUrl);

            // 2. Register two users with CSRF protection enabled.
            for (String email : List.of(emailA, emailB)) {
                String body = """
                        {"email":"%s","password":"%s"}
                        """.formatted(email, password);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + "/api/auth/register"))
                        .header("Content-Type", "application/json")
                        .header(csrf.headerName(), csrf.token())
                        .header("Cookie", csrf.cookie())
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();

                HttpResponse<String> response = client.send(
                        request, HttpResponse.BodyHandlers.ofString());

                assertEquals(201, response.statusCode(), response.body());
            }

            // 3. Create a booking owned by user A.
            Long ownerId = jdbcTemplate.queryForObject(
                    "SELECT id FROM users WHERE email = ?",
                    Long.class, emailA);

            Long eventId = createEventWithSeat();

            Booking booking = bookingService.createBooking(
                    ownerId, eventId, "A1");

            // 4. Log in as user A.
            String loginBodyA = """
                    {"email":"%s","password":"%s"}
                    """.formatted(emailA, password);

            HttpRequest loginA = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/auth/login"))
                    .header("Content-Type", "application/json")
                    .header(csrf.headerName(), csrf.token())
                    .header("Cookie", csrf.cookie())
                    .POST(HttpRequest.BodyPublishers.ofString(loginBodyA))
                    .build();

            HttpResponse<String> loginResponseA = client.send(
                    loginA, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, loginResponseA.statusCode(),
                    loginResponseA.body());

            String sessionA = loginResponseA.headers()
                    .allValues("Set-Cookie")
                    .stream()
                    .map(value -> value.split(";", 2)[0])
                    .filter(value -> value.startsWith("JSESSIONID="))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(
                            "Missing owner JSESSIONID"));

            // 5. Owner can access their booking.
            HttpRequest ownerRequest = HttpRequest.newBuilder()
                    .uri(URI.create(
                            baseUrl + "/api/bookings/" + booking.getId()))
                    .header("Cookie", sessionA)
                    .GET()
                    .build();

            HttpResponse<String> ownerResponse = client.send(
                    ownerRequest, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, ownerResponse.statusCode(),
                    ownerResponse.body());
            assertTrue(ownerResponse.body().contains("CONFIRMED"));

            // Cancel the booking and verify the HTTP API preserves history.
            bookingCancellationService.cancelBooking(
                    ownerId, booking.getId());

            HttpResponse<String> cancelledResponse = client.send(
                    ownerRequest,
                    HttpResponse.BodyHandlers.ofString());

            assertEquals(200, cancelledResponse.statusCode(),
                    cancelledResponse.body());

            ObjectMapper mapper = new ObjectMapper();
            JsonNode cancelledBooking =
                    mapper.readTree(cancelledResponse.body());

            assertEquals(
                    booking.getId().longValue(),
                    cancelledBooking.get("bookingId").asLong());

            assertEquals(
                    "CANCELLED",
                    cancelledBooking.get("status").asText());

            assertEquals(
                    "A1",
                    cancelledBooking.get("seats")
                            .get(0).get("seatLabel").asText());

            assertEquals(
                    10000,
                    cancelledBooking.get("seats")
                            .get(0).get("priceCents").asInt());


            // 6. Obtain a separate CSRF token for user B.
            CsrfSession csrfB = fetchCsrfSession(client, baseUrl);

            String loginBodyB = """
                    {"email":"%s","password":"%s"}
                    """.formatted(emailB, password);

            HttpRequest loginB = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/auth/login"))
                    .header("Content-Type", "application/json")
                    .header(csrfB.headerName(), csrfB.token())
                    .header("Cookie", csrfB.cookie())
                    .POST(HttpRequest.BodyPublishers.ofString(loginBodyB))
                    .build();

            HttpResponse<String> loginResponseB = client.send(
                    loginB, HttpResponse.BodyHandlers.ofString());

            assertEquals(200, loginResponseB.statusCode(),
                    loginResponseB.body());

            String sessionB = loginResponseB.headers()
                    .allValues("Set-Cookie")
                    .stream()
                    .map(value -> value.split(";", 2)[0])
                    .filter(value -> value.startsWith("JSESSIONID="))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(
                            "Missing second user JSESSIONID"));

            // 7. User B must not access user A's booking.
            HttpRequest otherRequest = HttpRequest.newBuilder()
                    .uri(URI.create(
                            baseUrl + "/api/bookings/" + booking.getId()))
                    .header("Cookie", sessionB)
                    .GET()
                    .build();

            HttpResponse<String> otherResponse = client.send(
                    otherRequest, HttpResponse.BodyHandlers.ofString());

            assertEquals(404, otherResponse.statusCode(),
                    otherResponse.body());
        }
    }


    @Test
    void shouldRetrieveCsrfTokenForHttpTests() throws Exception {
        try (HttpClient client = HttpClient.newHttpClient()) {
            String baseUrl = "http://localhost:" + port;

            CsrfSession csrf = fetchCsrfSession(client, baseUrl);

            assertEquals("X-XSRF-TOKEN", csrf.headerName());
            assertFalse(csrf.token().isBlank());
            assertTrue(csrf.cookie().startsWith("XSRF-TOKEN="));
        }
    }

}
