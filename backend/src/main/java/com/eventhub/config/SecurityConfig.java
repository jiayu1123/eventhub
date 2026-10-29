
package com.eventhub.config;

import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

@Configuration
public class SecurityConfig {

        @Bean
        public SecurityContextRepository securityContextRepository() {
                return new HttpSessionSecurityContextRepository();
        }

        @Bean
        public SecurityFilterChain securityFilterChain(
                        HttpSecurity http,
                        SecurityContextRepository securityContextRepository) throws Exception {

                http
                                .securityContext(context -> context
                                                .securityContextRepository(
                                                                securityContextRepository))

                                // Keep CSRF protection for session-based authentication
                                .csrf(csrf -> csrf
                                                .csrfTokenRepository(
                                                                CookieCsrfTokenRepository.withHttpOnlyFalse())
                                                .csrfTokenRequestHandler(
                                                                new CsrfTokenRequestAttributeHandler()))

                                // Return 401 for unauthenticated API requests
                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(
                                                                (request, response, authException) -> {
                                                                        response.sendError(
                                                                                        HttpStatus.UNAUTHORIZED.value(),
                                                                                        "Authentication required");
                                                                }))

                                // Public and protected endpoints
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/health",
                                                                "/api/events",
                                                                "/api/events/search",
                                                                "/api/events/*",
                                                                "/api/events/*/seats",
                                                                "/api/auth/csrf")
                                                .permitAll()

                                                .requestMatchers(
                                                                HttpMethod.POST,
                                                                "/api/auth/register",
                                                                "/api/auth/login")
                                                .permitAll()

                                                .anyRequest().authenticated());

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }
}
