
package com.eventhub.controller;

import com.eventhub.dto.CreateBookingRequest;
import com.eventhub.entity.Booking;

import com.eventhub.service.BookingCancellationService;
import com.eventhub.service.BookingQueryService;
import com.eventhub.service.BookingService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final BookingQueryService bookingQueryService;
    private final BookingCancellationService bookingCancellationService;

    public BookingController(
            BookingService bookingService,
            BookingQueryService bookingQueryService,
            BookingCancellationService bookingCancellationService) {

        this.bookingService = bookingService;
        this.bookingQueryService = bookingQueryService;
        this.bookingCancellationService = bookingCancellationService;
    }

    // Create a booking with multiple seats.
    @PostMapping
    public ResponseEntity<Map<String, Object>> createBooking(
            @Valid @RequestBody CreateBookingRequest request,
            Authentication authentication) {

        Long userId = Long.valueOf(authentication.getName());

        Booking booking = bookingService.createBooking(
                userId,
                request.eventId(),
                request.seats()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of(
                        "bookingId", booking.getId(),
                        "eventId", booking.getEventId(),
                        "seats", request.seats(),
                        "status", booking.getStatus()
                )
        );
    }

    // Get all bookings for the authenticated user.
    @GetMapping("/me")
    public ResponseEntity<List<Map<String, Object>>> myBookings(
            Authentication authentication) {

        Long userId = Long.valueOf(authentication.getName());

        List<Map<String, Object>> bookings =
                bookingQueryService.findBookingsByUserId(userId);

        return ResponseEntity.ok(bookings);
    }

    // Get one booking belonging to the authenticated user.
    @GetMapping("/{bookingId}")
    public ResponseEntity<Map<String, Object>> getBookingById(
            @PathVariable Long bookingId,
            Authentication authentication) {

        Long userId = Long.valueOf(authentication.getName());

        Map<String, Object> booking =
                bookingQueryService.findBookingById(
                        userId,
                        bookingId
                );

        return ResponseEntity.ok(booking);
    }

    // Cancel an existing booking.
    @PostMapping("/{bookingId}/cancel")
    public ResponseEntity<Map<String, Object>> cancelBooking(
            @PathVariable Long bookingId,
            Authentication authentication) {

        Long userId = Long.valueOf(authentication.getName());

        Booking booking = bookingCancellationService.cancelBooking(
                userId,
                bookingId
        );

        return ResponseEntity.ok(
                Map.of(
                        "bookingId", booking.getId(),
                        "eventId", booking.getEventId(),
                        "status", booking.getStatus()
                )
        );
    }
}
