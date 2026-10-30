package com.eventhub.controller;

import com.eventhub.service.AiBookingAgentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai/booking-agent")
public class AiBookingAgentController {

    private final AiBookingAgentService aiBookingAgentService;

    public AiBookingAgentController(
            AiBookingAgentService aiBookingAgentService) {
        this.aiBookingAgentService = aiBookingAgentService;
    }

    @PostMapping
    public ResponseEntity<AiBookingAgentService.AgentResponse> chat(
            @Valid @RequestBody AgentRequest request) {

        return ResponseEntity.ok(
                aiBookingAgentService.chat(request.message())
        );
    }

    public record AgentRequest(
            @NotBlank
            @Size(max = 2000)
            String message
    ) {}
}
