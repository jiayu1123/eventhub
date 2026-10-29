package com.eventhub;

import com.eventhub.service.AiEventSearchService;
import com.eventhub.service.EventSearchService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AiEventSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AiEventSearchService aiEventSearchService;

    @MockitoBean
    private EventSearchService eventSearchService;

    private static final String ENDPOINT = "/api/ai/events/search";

    private static final String REQUEST_BODY =
            "{\"message\":\"Find events in Boston under $100\"}";

    @Test
    void shouldRejectUnauthenticatedRequestWithCsrf() throws Exception {
        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .contentType("application/json")
                        .content(REQUEST_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectRequestWithoutCsrf() throws Exception {
        mockMvc.perform(post(ENDPOINT)
                        .contentType("application/json")
                        .content(REQUEST_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldRejectAuthenticatedRequestWithoutCsrf() throws Exception {
        mockMvc.perform(post(ENDPOINT)
                        .with(user("testuser"))
                        .contentType("application/json")
                        .content(REQUEST_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAllowAuthenticatedRequestWithCsrf() throws Exception {
        AiEventSearchService.SearchFilters filters =
                new AiEventSearchService.SearchFilters(
                        "Boston",
                        null,
                        null,
                        10000
                );

        when(aiEventSearchService.parseSearchFilters(
                "Find events in Boston under $100"))
                .thenReturn(filters);

        when(eventSearchService.searchEvents(
                eq("Boston"),
                any(),
                any(),
                eq(10000)
        )).thenReturn(List.of());

        mockMvc.perform(post(ENDPOINT)
                        .with(user("testuser"))
                        .with(csrf())
                        .contentType("application/json")
                        .content(REQUEST_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filters.city").value("Boston"))
                .andExpect(jsonPath("$.filters.maxPriceCents").value(10000))
                .andExpect(jsonPath("$.totalResults").value(0));

        verify(aiEventSearchService)
                .parseSearchFilters("Find events in Boston under $100");
    }
}
