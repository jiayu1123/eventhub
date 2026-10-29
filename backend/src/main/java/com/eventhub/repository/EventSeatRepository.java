
package com.eventhub.repository;

import com.eventhub.entity.EventSeat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventSeatRepository
        extends JpaRepository<EventSeat, Long> {

    List<EventSeat> findByEventIdOrderBySeatLabelAsc(
            Long eventId
    );

    boolean existsByEventIdAndSeatLabel(
            Long eventId,
            String seatLabel
    );

    Optional<EventSeat> findByEventIdAndSeatLabel(
            Long eventId,
            String seatLabel
    );
}
