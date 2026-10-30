package com.eventhub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class OpenAiClient {

    private static final String API_URL =
            "https://api.openai.com/v1/responses";

    private static final String MODEL = "gpt-4.1-mini";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public OpenAiClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }


    /**
     * Sends a Responses API request and returns the full JSON response.
     * Used by the booking agent to process function calls.
     */
    public JsonNode createResponse(Map<String, Object> payload) {
        String apiKey = System.getenv("OPENAI_API_KEY");

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "OPENAI_API_KEY is not configured");
        }

        try {
            String requestBody = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .timeout(Duration.ofSeconds(60))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200) {
                throw new IllegalStateException(
                        "OpenAI API request failed with status "
                                + response.statusCode());
            }

            return objectMapper.readTree(response.body());

        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                    "OpenAI request was interrupted", exception);
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to communicate with OpenAI", exception);
        }
    }

    public String generateResponse(
            String instructions,
            String userMessage) {

        String apiKey = System.getenv("OPENAI_API_KEY");

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "OPENAI_API_KEY is not configured");
        }

        try {
            String requestBody = objectMapper.writeValueAsString(
                    Map.of(
                            "model", MODEL,
                            "instructions", instructions,
                            "input", userMessage,
                            "max_output_tokens", 500
                    )
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() != 200) {
                throw new IllegalStateException(
                        "OpenAI API request failed with status "
                                + response.statusCode()
                );
            }

            JsonNode root = objectMapper.readTree(response.body());

            StringBuilder result = new StringBuilder();

            for (JsonNode output : root.path("output")) {
                if (!"message".equals(
                        output.path("type").asText())) {
                    continue;
                }

                for (JsonNode content : output.path("content")) {
                    if ("output_text".equals(
                            content.path("type").asText())) {
                        result.append(
                                content.path("text").asText());
                    }
                }
            }

            if (result.isEmpty()) {
                throw new IllegalStateException(
                        "OpenAI returned no text response");
            }

            return result.toString();

        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                    "OpenAI request was interrupted",
                    exception
            );
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to communicate with OpenAI",
                    exception
            );
        }
    }
}
