
package com.eventhub.service;

import com.eventhub.entity.Event;
import com.eventhub.repository.EventRepository;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class EventSearchService {

    private final EventRepository eventRepository;

    public EventSearchService(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    public List<Event> searchEvents(
            String city,
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            Integer maxPriceCents) {

        if (maxPriceCents != null && maxPriceCents < 0) {
            throw new IllegalArgumentException(
                    "Maximum price cannot be negative");
        }

        if (startDate != null && endDate != null
                && !startDate.isBefore(endDate)) {
            throw new IllegalArgumentException(
                    "Start date must be before end date");
        }

        String normalizedCity =
                city == null || city.isBlank() ? null : city.trim();

        Specification<Event> spec = (root, query, cb) ->
                cb.conjunction();

        if (normalizedCity != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(
                            cb.lower(root.get("city")),
                            normalizedCity.toLowerCase(java.util.Locale.ROOT)));
        }

        if (startDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.greaterThanOrEqualTo(
                            root.get("startsAt"), startDate));
        }

        if (endDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.lessThan(root.get("startsAt"), endDate));
        }

        if (maxPriceCents != null) {
            spec = spec.and((root, query, cb) ->
                    cb.lessThanOrEqualTo(
                            root.get("priceCents"), maxPriceCents));
        }

        return eventRepository.findAll(
                spec,
                org.springframework.data.domain.Sort.by(
                        "startsAt").ascending());
    }
}
