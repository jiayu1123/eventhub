
package com.eventhub.service;

import com.eventhub.entity.Booking;
import com.eventhub.repository.ActiveSeatReservationRepository;
import com.eventhub.repository.BookingRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookingCancellationService {

    private final BookingRepository bookingRepository;
    private final ActiveSeatReservationRepository activeReservationRepository;

    public BookingCancellationService(
            BookingRepository bookingRepository,
            ActiveSeatReservationRepository activeReservationRepository) {

        this.bookingRepository = bookingRepository;
        this.activeReservationRepository = activeReservationRepository;
    }

    @Transactional
    public Booking cancelBooking(Long userId, Long bookingId) {

        Booking booking = bookingRepository
                .findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Booking not found"
                ));

        if (!booking.getUserId().equals(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You cannot cancel another user's booking"
            );
        }

        if ("CANCELLED".equals(booking.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Booking already cancelled"
            );
        }

        // Release active seat reservations.
        activeReservationRepository.deleteByBookingId(bookingId);

        // Keep booking_seats as permanent booking history.
        booking.cancel();

        return bookingRepository.save(booking);
    }
}
