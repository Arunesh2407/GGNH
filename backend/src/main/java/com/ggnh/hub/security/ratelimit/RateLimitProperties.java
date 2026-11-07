package com.ggnh.hub.security.ratelimit;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    /**
     * Whether rate limiting is enabled.
     */
    private boolean enabled = true;

    /**
     * Maximum POST requests per minute to /appointments.
     */
    private int appointmentsPerMinute = 10;

    /**
     * Maximum POST requests per minute to /auth/register and /auth/sync.
     */
    private int authPerMinute = 10;

    /**
     * Whether to trust X-Forwarded-For header for client IP extraction.
     * Default is false to prevent IP spoofing when direct connections to the container are permitted.
     */
    private boolean trustProxyHeaders = false;
}

