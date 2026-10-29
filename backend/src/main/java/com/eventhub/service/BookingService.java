
package com.eventhub.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.eventhub.entity.ActiveSeatReservation;
import com.eventhub.entity.Booking;
import com.eventhub.entity.BookingSeat;
import com.eventhub.entity.EventSeat;

import com.eventhub.repository.ActiveSeatReservationRepository;
import com.eventhub.repository.BookingRepository;
import com.eventhub.repository.BookingSeatRepository;
import com.eventhub.repository.EventRepository;
import com.eventhub.repository.EventSeatRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final EventRepository eventRepository;
    private final EventSeatRepository eventSeatRepository;
    private final ActiveSeatReservationRepository activeReservationRepository;

    public BookingService(
            BookingRepository bookingRepository,
            BookingSeatRepository bookingSeatRepository,
            EventRepository eventRepository,
            EventSeatRepository eventSeatRepository,
            ActiveSeatReservationRepository activeReservationRepository) {

        this.bookingRepository = bookingRepository;
        this.bookingSeatRepository = bookingSeatRepository;
        this.eventRepository = eventRepository;
        this.eventSeatRepository = eventSeatRepository;
        this.activeReservationRepository = activeReservationRepository;
    }

    // Backward-compatible single-seat booking.
    // Keeps existing integration tests working.
    @Transactional
    public Booking createBooking(
            Long userId,
            Long eventId,
            String seatLabel) {

        if (seatLabel == null || seatLabel.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Seat label cannot be empty"
            );
        }

        return createBooking(
                userId,
                eventId,
                List.of(seatLabel)
        );
    }

    // Multi-seat booking.
    // All selected seats are reserved in one transaction.
    @Transactional
    public Booking createBooking(
            Long userId,
            Long eventId,
            List<String> seats) {

        // 1. Validate the seat list.
        if (seats == null || seats.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "At least one seat is required"
            );
        }

        if (seats.stream().anyMatch(
                seat -> seat == null || seat.isBlank())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Seat labels cannot be empty"
            );
        }

        Set<String> uniqueSeats = new HashSet<>(seats);

        if (uniqueSeats.size() != seats.size()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Duplicate seats are not allowed"
            );
        }

        // 2. Verify that the event exists.
        if (!eventRepository.existsById(eventId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Event not found"
            );
        }

        // 3. Validate all selected seats before booking.
        List<EventSeat> selectedSeats = new ArrayList<>();

        for (String seatLabel : seats) {

            EventSeat eventSeat = eventSeatRepository
                    .findByEventIdAndSeatLabel(eventId, seatLabel)
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Invalid seat: " + seatLabel
                            )
                    );

            if (activeReservationRepository
                    .existsByEventIdAndSeatLabel(
                            eventId,
                            seatLabel)) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Seat already booked: " + seatLabel
                );
            }

            selectedSeats.add(eventSeat);
        }

        // 4. Create one booking for all selected seats.
        Booking booking = bookingRepository.save(
                new Booking(userId, eventId)
        );

        // 5. Reserve all seats in the same transaction.
        for (EventSeat eventSeat : selectedSeats) {

            String seatLabel = eventSeat.getSeatLabel();

            try {
                activeReservationRepository.saveAndFlush(
                        new ActiveSeatReservation(
                                booking.getId(),
                                eventId,
                                seatLabel
                        )
                );

            } catch (DataIntegrityViolationException ex) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Seat already booked: " + seatLabel,
                        ex
                );
            }

            // Preserve the original ticket price.
            bookingSeatRepository.save(
                    new BookingSeat(
                            booking.getId(),
                            eventId,
                            seatLabel,
                            eventSeat.getPriceCents()
                    )
            );
        }

        // 6. Return the confirmed booking.
        return booking;
    }
}
