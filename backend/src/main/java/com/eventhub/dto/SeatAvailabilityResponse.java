package com.eventhub.dto;

public record SeatAvailabilityResponse(
        Long id,
        Long eventId,
        String seatLabel,
        Integer priceCents,
        boolean available
) {
}
