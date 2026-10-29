package com.eventhub.controller;

import com.eventhub.entity.Event;
import com.eventhub.service.AiEventSearchService;
import com.eventhub.service.EventSearchService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai/events")
public class AiEventController {

    private final AiEventSearchService aiEventSearchService;
    private final EventSearchService eventSearchService;

    public AiEventController(
            AiEventSearchService aiEventSearchService,
            EventSearchService eventSearchService) {

        this.aiEventSearchService = aiEventSearchService;
        this.eventSearchService = eventSearchService;
    }

    @PostMapping("/parse")
    public ResponseEntity<AiEventSearchService.SearchFilters> parse(
            @Valid @RequestBody SearchRequest request) {

        return ResponseEntity.ok(
                aiEventSearchService.parseSearchFilters(request.message())
        );
    }

    @PostMapping("/search")
    public ResponseEntity<AiSearchResponse> search(
            @Valid @RequestBody SearchRequest request) {

        AiEventSearchService.SearchFilters filters =
                aiEventSearchService.parseSearchFilters(
                        request.message()
                );

        List<Event> events = eventSearchService.searchEvents(
                filters.city(),
                filters.startDate(),
                filters.endDate(),
                filters.maxPriceCents()
        );

        return ResponseEntity.ok(
                new AiSearchResponse(
                        filters,
                        events,
                        events.size()
                )
        );
    }

    public record SearchRequest(
            @NotBlank
            @Size(max = 2000)
            String message
    ) {}

    public record AiSearchResponse(
            AiEventSearchService.SearchFilters filters,
            List<Event> events,
            int totalResults
    ) {}
}
