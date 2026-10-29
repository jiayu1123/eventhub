package com.eventhub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;

@Service
public class AiEventSearchService {

    private static final ZoneId EVENT_TIME_ZONE =
            ZoneId.of("America/New_York");

    private final OpenAiClient openAiClient;
    private final ObjectMapper objectMapper;

    public AiEventSearchService(
            OpenAiClient openAiClient,
            ObjectMapper objectMapper) {
        this.openAiClient = openAiClient;
        this.objectMapper = objectMapper;
    }

    public SearchFilters parseSearchFilters(String userMessage) {

        if (userMessage == null || userMessage.isBlank()) {
            throw new IllegalArgumentException(
                    "Search message cannot be empty");
        }

        if (userMessage.length() > 2000) {
            throw new IllegalArgumentException(
                    "Search message is too long");
        }

        LocalDate today = LocalDate.now(EVENT_TIME_ZONE);

        String instructions = """
                You are a search-filter parser for an event application.

                Convert the user's request into a JSON object with exactly
                these four fields:

                {
                  "city": null,
                  "startDate": null,
                  "endDate": null,
                  "maxPriceCents": null
                }

                Rules:
                - Return ONLY a valid JSON object.
                - Do not include Markdown or explanations.
                - city must be a city name or null.
                - startDate and endDate must be ISO-8601 calendar dates
                  in YYYY-MM-DD format, or null.
                - startDate is inclusive.
                - endDate is exclusive.
                - maxPriceCents must be a nonnegative integer or null.
                - Convert dollar amounts to cents.
                - For "under $100", use 10000 cents.
                - For a single date, set endDate to the following day.
                - For a month, use the first day of that month and
                  the first day of the following month.
                - Resolve relative dates using the current date.
                - Do not invent missing search conditions.

                Current date: %s
                Event time zone: America/New_York
                """.formatted(today);

        String aiResponse =
                openAiClient.generateResponse(instructions, userMessage);

        try {
            JsonNode root = objectMapper.readTree(aiResponse);

            if (!root.isObject()) {
                throw new IllegalArgumentException(
                        "AI returned invalid search filters");
            }

            String city = optionalText(root, "city");
            LocalDate startDate = optionalDate(root, "startDate");
            LocalDate endDate = optionalDate(root, "endDate");
            Integer maxPriceCents = optionalPrice(root, "maxPriceCents");

            if (startDate != null && endDate != null
                    && !startDate.isBefore(endDate)) {
                throw new IllegalArgumentException(
                        "AI returned an invalid date range");
            }

            return new SearchFilters(
                    city,
                    toOffsetDateTime(startDate),
                    toOffsetDateTime(endDate),
                    maxPriceCents
            );

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(
                    "AI returned invalid JSON", e);
        }
    }

    private String optionalText(JsonNode root, String field) {
        JsonNode value = root.path(field);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isTextual()) {
            throw new IllegalArgumentException(
                    "Invalid text filter: " + field);
        }

        String text = value.asText().trim();

        return text.isEmpty() ? null : text;
    }

    private LocalDate optionalDate(JsonNode root, String field) {
        String value = optionalText(root, field);

        if (value == null) {
            return null;
        }

        try {
            return LocalDate.parse(value);
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Invalid date filter: " + field, e);
        }
    }

    private Integer optionalPrice(JsonNode root, String field) {
        JsonNode value = root.path(field);

        if (value.isMissingNode() || value.isNull()) {
            return null;
        }

        if (!value.isIntegralNumber() || !value.canConvertToInt()) {
            throw new IllegalArgumentException(
                    "Invalid price filter");
        }

        int price = value.intValue();

        if (price < 0) {
            throw new IllegalArgumentException(
                    "Price cannot be negative");
        }

        return price;
    }

    private OffsetDateTime toOffsetDateTime(LocalDate date) {
        if (date == null) {
            return null;
        }

        return date.atStartOfDay(EVENT_TIME_ZONE)
                .toOffsetDateTime();
    }

    public record SearchFilters(
            String city,
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            Integer maxPriceCents
    ) {}
}
