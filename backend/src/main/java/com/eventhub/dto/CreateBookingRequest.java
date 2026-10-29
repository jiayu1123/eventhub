
package com.eventhub.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateBookingRequest(
    @NotNull Long eventId,
    @NotEmpty List<@NotNull String> seats
) {
}
