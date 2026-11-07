package com.ggnh.hub.security.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimitProperties properties;
    private final InMemoryRateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        if (!properties.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }

        String method = request.getMethod();
        String uri = request.getRequestURI();

        if ("POST".equalsIgnoreCase(method)) {
            if (uri.endsWith("/appointments")) {
                if (!checkRateLimit(request, response, "appointments", properties.getAppointmentsPerMinute())) {
                    return;
                }
            } else if (uri.endsWith("/auth/register") || uri.endsWith("/auth/sync")) {
                if (!checkRateLimit(request, response, "auth", properties.getAuthPerMinute())) {
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean checkRateLimit(HttpServletRequest request, HttpServletResponse response, String category, int limit) throws IOException {
        String clientIp = resolveClientIp(request);
        String key = category + ":" + clientIp;

        if (!rateLimiter.tryAcquire(key, limit)) {
            // Avoid logging sensitive request contents (passwords, tokens, personal health details)
            log.warn("Rate limit exceeded for endpoint category '{}' from client IP '{}'", category, clientIp);
            sendRateLimitExceeded(response, request.getRequestURI());
            return false;
        }

        return true;
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (properties.isTrustProxyHeaders()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }

    private void sendRateLimitExceeded(HttpServletResponse response, String path) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
        body.put("error", "Too Many Requests");
        body.put("message", "Rate limit exceeded. Please try again later.");
        body.put("path", path);

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}

