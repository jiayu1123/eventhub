
package com.eventhub.controller;

import com.eventhub.dto.LoginRequest;
import com.eventhub.dto.RegisterRequest;
import com.eventhub.entity.User;
import com.eventhub.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

        private final AuthService authService;
        private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

        public AuthController(AuthService authService) {
                this.authService = authService;
        }

        // Register a new user
        @PostMapping("/register")
        public ResponseEntity<Map<String, Object>> register(
                        @Valid @RequestBody RegisterRequest request) {

                User user = authService.register(
                                request.email(),
                                request.password());

                return ResponseEntity.status(HttpStatus.CREATED).body(
                                Map.of(
                                                "id", user.getId(),
                                                "email", user.getEmail()));
        }

        // Login and create an authenticated session
        @PostMapping("/login")
        public ResponseEntity<Map<String, Object>> login(
                        @Valid @RequestBody LoginRequest request,
                        HttpServletRequest servletRequest,
                        HttpServletResponse servletResponse) {

                User user = authService.authenticate(
                                request.email(),
                                request.password());

                // Invalidate any existing session
                HttpSession oldSession = servletRequest.getSession(false);

                if (oldSession != null) {
                        oldSession.invalidate();
                }

                servletRequest.getSession(true);

                // Create Spring Security authentication
                Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                                user.getId().toString(),
                                null,
                                List.of(
                                                new SimpleGrantedAuthority("ROLE_USER")));

                SecurityContext context = SecurityContextHolder.createEmptyContext();

                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);

                // Save authentication to HTTP session
                securityContextRepository.saveContext(
                                context,
                                servletRequest,
                                servletResponse);

                return ResponseEntity.ok(
                                Map.of(
                                                "id", user.getId(),
                                                "email", user.getEmail()));
        }

        // Get currently authenticated user
        @GetMapping("/me")
        public ResponseEntity<Map<String, Object>> me(
                        Authentication authentication) {

                if (authentication == null
                                || !authentication.isAuthenticated()
                                || "anonymousUser".equals(
                                                authentication.getPrincipal())) {

                        return ResponseEntity.status(
                                        HttpStatus.UNAUTHORIZED).build();
                }

                Long userId = Long.valueOf(authentication.getName());

                User user = authService.findById(userId);

                return ResponseEntity.ok(
                                Map.of(
                                                "id", user.getId(),
                                                "email", user.getEmail()));
        }

        // Logout and invalidate current session
        @PostMapping("/logout")
        public ResponseEntity<Map<String, String>> logout(
                        HttpServletRequest request) {

                HttpSession session = request.getSession(false);

                if (session != null) {
                        session.invalidate();
                }

                SecurityContextHolder.clearContext();

                return ResponseEntity.ok(
                                Map.of(
                                                "message", "Logged out successfully"));
        }
}
