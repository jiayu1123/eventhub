package com.eventhub.dto;

import java.util.List;

public record BookingProposal(
        Long eventId,
        String eventTitle,
        List<String> seats,
        Integer totalPriceCents
) {
}
