package com.eventhub;

import com.eventhub.service.AiEventSearchService;
import com.eventhub.service.OpenAiClient;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AiEventSearchServiceTest {

    private OpenAiClient openAiClient;
    private AiEventSearchService service;

    @BeforeEach
    void setUp() {
        openAiClient = mock(OpenAiClient.class);
        service = new AiEventSearchService(
                openAiClient,
                new ObjectMapper()
        );
    }

    @Test
    void shouldParseValidSearchFilters() {
        when(openAiClient.generateResponse(anyString(), anyString()))
                .thenReturn("""
                        {
                          "city": "Boston",
                          "startDate": null,
                          "endDate": null,
                          "maxPriceCents": 10000
                        }
                        """);

        var filters = service.parseSearchFilters(
                "Find events in Boston under $100"
        );

        assertEquals("Boston", filters.city());
        assertEquals(10000, filters.maxPriceCents());
        assertNull(filters.startDate());
        assertNull(filters.endDate());
    }

    @Test
    void shouldRejectInvalidJson() {
        when(openAiClient.generateResponse(anyString(), anyString()))
                .thenReturn("not valid JSON");

        assertThrows(
                IllegalStateException.class,
                () -> service.parseSearchFilters("Find events")
        );
    }

    @Test
    void shouldRejectInvalidDateRange() {
        when(openAiClient.generateResponse(anyString(), anyString()))
                .thenReturn("""
                        {
                          "city": "Boston",
                          "startDate": "2030-06-10",
                          "endDate": "2030-06-01",
                          "maxPriceCents": null
                        }
                        """);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.parseSearchFilters("Find June events")
        );
    }

    @Test
    void shouldRejectNegativePrice() {
        when(openAiClient.generateResponse(anyString(), anyString()))
                .thenReturn("""
                        {
                          "city": null,
                          "startDate": null,
                          "endDate": null,
                          "maxPriceCents": -100
                        }
                        """);

        assertThrows(
                IllegalArgumentException.class,
                () -> service.parseSearchFilters("Find cheap events")
        );
    }

    @Test
    void shouldRejectBlankInputWithoutCallingOpenAI() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.parseSearchFilters("   ")
        );

        verifyNoInteractions(openAiClient);
    }

    @Test
    void shouldRejectOversizedInputWithoutCallingOpenAI() {
        assertThrows(
                IllegalArgumentException.class,
                () -> service.parseSearchFilters("a".repeat(2001))
        );

        verifyNoInteractions(openAiClient);
    }
}
