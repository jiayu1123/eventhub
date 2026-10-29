package com.eventhub;

import com.eventhub.entity.Event;
import com.eventhub.service.EventSearchService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Testcontainers
class AiEventSearchIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16")
                    .withDatabaseName("eventhub_ai_test")
                    .withUsername("test")
                    .withPassword("test");

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private EventSearchService eventSearchService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long createEvent(
            String city,
            OffsetDateTime startsAt,
            int priceCents) {

        return jdbcTemplate.queryForObject(
                """
                INSERT INTO events
                    (title, city, venue, starts_at, price_cents)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                "AI Test Event " + UUID.randomUUID(),
                city,
                "Test Venue",
                startsAt,
                priceCents
        );
    }

    @Test
    void shouldFindEventsByCityAndPrice() {
        Long matchingId = createEvent(
                "AI-Test-Boston",
                OffsetDateTime.now().plusDays(30),
                6500
        );

        createEvent(
                "AI-Test-Boston",
                OffsetDateTime.now().plusDays(30),
                15000
        );

        List<Event> results = eventSearchService.searchEvents(
                "AI-Test-Boston",
                null,
                null,
                10000
        );

        assertEquals(1, results.size());
        assertEquals(matchingId, results.get(0).getId());
    }

    @Test
    void shouldReturnEmptyResultsForUnknownCity() {
        List<Event> results = eventSearchService.searchEvents(
                "AI-Unknown-City-" + UUID.randomUUID(),
                null,
                null,
                null
        );

        assertTrue(results.isEmpty());
    }

    @Test
    void shouldFilterEventsByDateRange() {
        OffsetDateTime baseDate = OffsetDateTime.of(
                2030, 6, 1, 0, 0, 0, 0,
                ZoneOffset.UTC
        );

        Long matchingId = createEvent(
                "AI-Test-Date-City",
                baseDate.plusDays(5),
                5000
        );

        createEvent(
                "AI-Test-Date-City",
                baseDate.plusDays(30),
                5000
        );

        List<Event> results = eventSearchService.searchEvents(
                "AI-Test-Date-City",
                baseDate,
                baseDate.plusDays(10),
                null
        );

        assertEquals(1, results.size());
        assertEquals(matchingId, results.get(0).getId());
    }

    @Test
    void shouldRejectNegativeMaximumPrice() {
        assertThrows(
                IllegalArgumentException.class,
                () -> eventSearchService.searchEvents(
                        null,
                        null,
                        null,
                        -100
                )
        );
    }
}
