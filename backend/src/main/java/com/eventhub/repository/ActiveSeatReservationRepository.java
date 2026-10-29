package com.eventhub.repository;

import com.eventhub.entity.ActiveSeatReservation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActiveSeatReservationRepository
        extends JpaRepository<ActiveSeatReservation, Long> {

    boolean existsByEventIdAndSeatLabel(
            Long eventId,
            String seatLabel
    );

    void deleteByBookingId(Long bookingId);
}