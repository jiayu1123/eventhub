package com.eventhub.service;

import com.eventhub.dto.BookingProposal;
import com.eventhub.dto.SeatAvailabilityResponse;
import com.eventhub.entity.Event;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiBookingAgentService {

    private static final String MODEL = "gpt-4.1-mini";
    private static final int MAX_ROUNDS = 5;
    private static final ZoneId EVENT_ZONE =
            ZoneId.of("America/New_York");

    private final OpenAiClient openAiClient;
    private final EventSearchService eventSearchService;
    private final SeatAvailabilityService seatAvailabilityService;
    private final ObjectMapper objectMapper;

    public AiBookingAgentService(
            OpenAiClient openAiClient,
            EventSearchService eventSearchService,
            SeatAvailabilityService seatAvailabilityService,
            ObjectMapper objectMapper) {

        this.openAiClient = openAiClient;
        this.eventSearchService = eventSearchService;
        this.seatAvailabilityService = seatAvailabilityService;
        this.objectMapper = objectMapper;
    }

    public AgentResponse chat(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }

        if (message.length() > 2000) {
            throw new IllegalArgumentException("Message is too long");
        }

        String instructions = """
                You are EventHub's AI Booking Agent.

                Help users find real events and available seats.

                Rules:
                - Use search_events to find events.
                - Use get_available_seats before recommending specific seats.
                - When recommending specific seats, call propose_booking.
                - Only describe proposals as validated after successful tool execution.
                - A validated proposal is not a confirmed reservation.
                - Never invent events, seat availability, or prices.
                - Prices returned by tools are in cents.
                - Distinguish per-ticket budgets from total budgets.
                - For multiple seats, calculate the combined total price.
                - Recommend adjacent seats only when seat labels
                  clearly support adjacency.
                - If seat adjacency cannot be verified, say so.
                - Event categories are not stored separately.
                  Use event titles when considering event types.
                - Do not claim that seats are held or reserved.
                - Availability may change before booking.
                - You cannot create bookings or process payments.
                - Ask the user to confirm booking through the app.
                - Keep responses clear and concise.

                Current date: %s
                Event timezone: America/New_York
                """.formatted(LocalDate.now(EVENT_ZONE));

        List<Map<String, Object>> input = new ArrayList<>();
        input.add(Map.of(
                "role", "user",
                "content", message
        ));

        List<String> toolsUsed = new ArrayList<>();
        List<BookingProposal> validatedProposals = new ArrayList<>();

        for (int round = 0; round < MAX_ROUNDS; round++) {

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", MODEL);
            payload.put("instructions", instructions);
            payload.put("input", input);
            payload.put("tools", toolDefinitions());
            payload.put("max_output_tokens", 1200);

            JsonNode response = openAiClient.createResponse(payload);

            if (!"completed".equals(response.path("status").asText())) {
                throw new IllegalStateException(
                        "AI response did not complete successfully");
            }

            List<JsonNode> calls = new ArrayList<>();
            StringBuilder answer = new StringBuilder();

            for (JsonNode output : response.path("output")) {

                if ("function_call".equals(
                        output.path("type").asText())) {
                    calls.add(output);
                }

                if ("message".equals(output.path("type").asText())) {
                    for (JsonNode content : output.path("content")) {
                        if ("output_text".equals(
                                content.path("type").asText())) {
                            answer.append(content.path("text").asText());
                        }
                    }
                }
            }

            if (calls.isEmpty()) {
                if (answer.isEmpty()) {
                    throw new IllegalStateException(
                            "AI returned no answer");
                }

                BookingProposal proposal = validatedProposals.isEmpty()
                        ? null
                        : validatedProposals.get(validatedProposals.size() - 1);

                return new AgentResponse(
                        answer.toString(),
                        toolsUsed,
                        proposal
                );
            }

            // Preserve the model's output items, including call IDs,
            // before appending function_call_output messages.
            for (JsonNode output : response.path("output")) {
                input.add(objectMapper.convertValue(
                        output,
                        new com.fasterxml.jackson.core.type.TypeReference<
                                Map<String, Object>>() {}
                ));
            }

            for (JsonNode call : calls) {
                String name = call.path("name").asText();
                String callId = call.path("call_id").asText();

                if (callId.isBlank()) {
                    throw new IllegalStateException(
                            "AI tool call is missing call_id");
                }

                String result;

                try {
                    JsonNode args = objectMapper.readTree(
                            call.path("arguments").asText("{}"));

                    if ("propose_booking".equals(name)) {
                        BookingProposal proposal = proposeBooking(args);
                        validatedProposals.add(proposal);

                        result = objectMapper.writeValueAsString(
                                Map.of(
                                        "status", "validated",
                                        "proposal", proposal,
                                        "bookingCreated", false
                                ));
                    } else {
                        result = executeTool(name, args);
                    }

                    toolsUsed.add(name);

                } catch (Exception exception) {
                    result = "{\"error\":\"Tool execution failed or arguments were invalid\"}";
                }

                input.add(Map.of(
                        "type", "function_call_output",
                        "call_id", callId,
                        "output", result
                ));
            }
        }

        throw new IllegalStateException(
                "AI Booking Agent exceeded maximum tool rounds");
    }

    private BookingProposal validateBookingProposal(
            Long eventId,
            List<String> requestedSeats) {

        if (eventId == null || eventId <= 0) {
            throw new IllegalArgumentException("Invalid event ID");
        }

        if (requestedSeats == null
                || requestedSeats.isEmpty()
                || requestedSeats.size() > 10) {
            throw new IllegalArgumentException("Invalid seat count");
        }

        List<SeatAvailabilityResponse> availableSeats =
                seatAvailabilityService.getSeats(eventId).stream()
                        .filter(SeatAvailabilityResponse::available)
                        .toList();

        List<SeatAvailabilityResponse> selected = new ArrayList<>();

        for (String label : requestedSeats) {
            if (label == null || label.isBlank()) {
                throw new IllegalArgumentException("Invalid seat label");
            }

            SeatAvailabilityResponse seat = availableSeats.stream()
                    .filter(s -> s.seatLabel().equals(label))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Seat is unavailable: " + label));

            if (selected.stream().anyMatch(
                    s -> s.seatLabel().equals(label))) {
                throw new IllegalArgumentException("Duplicate seat");
            }

            selected.add(seat);
        }

        // Verify that labels share the same row and consecutive numbers.
        String row = null;
        List<Integer> numbers = new ArrayList<>();

        for (SeatAvailabilityResponse seat : selected) {
            String label = seat.seatLabel();

            java.util.regex.Matcher matcher =
                    java.util.regex.Pattern
                            .compile("^([A-Za-z]+)([0-9]+)$")
                            .matcher(label);

            if (!matcher.matches()) {
                throw new IllegalArgumentException(
                        "Cannot verify seat adjacency");
            }

            if (row == null) {
                row = matcher.group(1);
            } else if (!row.equals(matcher.group(1))) {
                throw new IllegalArgumentException(
                        "Seats must be in the same row");
            }

            numbers.add(Integer.parseInt(matcher.group(2)));
        }

        numbers.sort(Integer::compareTo);

        for (int i = 1; i < numbers.size(); i++) {
            if (numbers.get(i) != numbers.get(i - 1) + 1) {
                throw new IllegalArgumentException(
                        "Seats must have consecutive numbers");
            }
        }

        int totalPriceCents = selected.stream()
                .mapToInt(SeatAvailabilityResponse::priceCents)
                .sum();

        Event event = eventSearchService.searchEvents(
                        null, null, null, null)
                .stream()
                .filter(e -> e.getId().equals(eventId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Event not found"));

        return new BookingProposal(
                event.getId(),
                event.getTitle(),
                List.copyOf(requestedSeats),
                totalPriceCents
        );
    }

    private BookingProposal proposeBooking(JsonNode args) {
        JsonNode idNode = args.path("eventId");
        JsonNode seatsNode = args.path("seats");

        if (!idNode.isIntegralNumber()
                || !idNode.canConvertToLong()
                || idNode.longValue() <= 0) {
            throw new IllegalArgumentException("Invalid event ID");
        }

        if (!seatsNode.isArray()) {
            throw new IllegalArgumentException("Invalid seats");
        }

        List<String> seats = new ArrayList<>();

        for (JsonNode seat : seatsNode) {
            if (!seat.isTextual()) {
                throw new IllegalArgumentException("Invalid seat label");
            }
            seats.add(seat.asText());
        }

        return validateBookingProposal(idNode.longValue(), seats);
    }

    private String executeTool(String name, JsonNode args)
            throws Exception {

        return switch (name) {
            case "search_events" -> searchEvents(args);
            case "get_available_seats" -> getAvailableSeats(args);
            default -> throw new IllegalArgumentException(
                    "Unknown tool: " + name);
        };
    }

    private String searchEvents(JsonNode args) throws Exception {

        String city = optionalString(args, "city");
        String start = optionalString(args, "startDate");
        String end = optionalString(args, "endDate");

        OffsetDateTime startDate = start == null
                ? null
                : LocalDate.parse(start)
                    .atStartOfDay(EVENT_ZONE)
                    .toOffsetDateTime();

        OffsetDateTime endDate = end == null
                ? null
                : LocalDate.parse(end)
                    .atStartOfDay(EVENT_ZONE)
                    .toOffsetDateTime();

        Integer maxPrice = null;
        JsonNode priceNode = args.path("maxPriceCents");

        if (!priceNode.isMissingNode() && !priceNode.isNull()) {
            if (!priceNode.isIntegralNumber()
                    || !priceNode.canConvertToInt()
                    || priceNode.intValue() < 0) {
                throw new IllegalArgumentException("Invalid price");
            }
            maxPrice = priceNode.intValue();
        }

        List<Event> events = eventSearchService.searchEvents(
                city, startDate, endDate, maxPrice);

        List<Map<String, Object>> results = new ArrayList<>();

        for (Event event : events.stream().limit(30).toList()) {
            results.add(Map.of(
                    "id", event.getId(),
                    "title", event.getTitle(),
                    "city", event.getCity(),
                    "venue", event.getVenue(),
                    "startsAt", event.getStartsAt().toString(),
                    "startingPriceCents", event.getPriceCents()
            ));
        }

        return objectMapper.writeValueAsString(Map.of(
                "events", results,
                "totalMatches", events.size(),
                "resultsTruncated", events.size() > 30
        ));
    }

    private String getAvailableSeats(JsonNode args) throws Exception {

        JsonNode idNode = args.path("eventId");

        if (!idNode.isIntegralNumber()
                || !idNode.canConvertToLong()
                || idNode.longValue() <= 0) {
            throw new IllegalArgumentException("Invalid event ID");
        }

        long eventId = idNode.longValue();

        List<SeatAvailabilityResponse> seats =
                seatAvailabilityService.getSeats(eventId);

        List<SeatAvailabilityResponse> available = seats.stream()
                .filter(SeatAvailabilityResponse::available)
                .toList();

        return objectMapper.writeValueAsString(Map.of(
                "eventId", eventId,
                "availableCount", available.size(),
                "seats", available.stream().limit(100).toList(),
                "resultsTruncated", available.size() > 100
        ));
    }

    private String optionalString(JsonNode args, String key) {
        JsonNode value = args.path(key);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isTextual()) {
            throw new IllegalArgumentException(
                    "Invalid argument: " + key);
        }

        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private List<Map<String, Object>> toolDefinitions() {
        return List.of(
                Map.of(
                        "type", "function",
                        "name", "search_events",
                        "description",
                        "Search real EventHub events by city, date and maximum starting ticket price.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "city", Map.of(
                                                "type", List.of("string", "null")),
                                        "startDate", Map.of(
                                                "type", List.of("string", "null"),
                                                "description", "Inclusive YYYY-MM-DD"),
                                        "endDate", Map.of(
                                                "type", List.of("string", "null"),
                                                "description", "Exclusive YYYY-MM-DD"),
                                        "maxPriceCents", Map.of(
                                                "type", List.of("integer", "null"),
                                                "description", "Maximum starting ticket price in cents")
                                ),
                                "required", List.of(
                                        "city", "startDate",
                                        "endDate", "maxPriceCents"),
                                "additionalProperties", false
                        ),
                        "strict", true
                ),
                Map.of(
                        "type", "function",
                        "name", "get_available_seats",
                        "description",
                        "Retrieve currently available seats and individual seat prices for an event.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "eventId", Map.of(
                                                "type", "integer",
                                                "description", "Event ID returned by search_events")
                                ),
                                "required", List.of("eventId"),
                                "additionalProperties", false
                        ),
                        "strict", true
                ),
                Map.of(
                        "type", "function",
                        "name", "propose_booking",
                        "description",
                        "Propose available seats for an event. "
                                + "The backend validates seats and calculates prices. "
                                + "This does not create a booking.",
                        "parameters", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "eventId", Map.of("type", "integer"),
                                        "seats", Map.of(
                                                "type", "array",
                                                "items", Map.of("type", "string")
                                        )
                                ),
                                "required", List.of("eventId", "seats"),
                                "additionalProperties", false
                        ),
                        "strict", true
                )
        );
    }

    public record AgentResponse(
            String message,
            List<String> toolsUsed,
            BookingProposal proposal
    ) {}
}
