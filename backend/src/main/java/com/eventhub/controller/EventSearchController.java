
package com.eventhub.controller;

import com.eventhub.entity.Event;
import com.eventhub.service.EventSearchService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/events/search")
public class EventSearchController {

    private final EventSearchService eventSearchService;

    public EventSearchController(EventSearchService eventSearchService) {
        this.eventSearchService = eventSearchService;
    }

    @GetMapping
    public ResponseEntity<List<Event>> searchEvents(
            @RequestParam(required = false) String city,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime startDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            OffsetDateTime endDate,

            @RequestParam(required = false) Integer maxPriceCents
    ) {
        return ResponseEntity.ok(
            eventSearchService.searchEvents(
                city,
                startDate,
                endDate,
                maxPriceCents
            )
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleInvalidSearch(
            IllegalArgumentException exception
    ) {
        return ResponseEntity.badRequest()
                .body(exception.getMessage());
    }
}
