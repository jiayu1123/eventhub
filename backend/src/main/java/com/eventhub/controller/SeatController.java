
package com.eventhub.controller;

import com.eventhub.dto.SeatAvailabilityResponse;
import com.eventhub.repository.EventRepository;
import com.eventhub.service.SeatAvailabilityService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events/{eventId}/seats")
public class SeatController {

    private final EventRepository eventRepository;
    private final SeatAvailabilityService seatAvailabilityService;

    public SeatController(
            EventRepository eventRepository,
            SeatAvailabilityService seatAvailabilityService) {

        this.eventRepository = eventRepository;
        this.seatAvailabilityService = seatAvailabilityService;
    }

    @GetMapping
    public ResponseEntity<List<SeatAvailabilityResponse>> getSeats(
            @PathVariable Long eventId) {

        if (!eventRepository.existsById(eventId)) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(
                seatAvailabilityService.getSeats(eventId)
        );
    }
}
