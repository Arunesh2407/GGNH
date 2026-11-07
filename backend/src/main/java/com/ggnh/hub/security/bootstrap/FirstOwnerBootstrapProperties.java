package com.ggnh.hub.security.bootstrap;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for the one-time first-owner administrative bootstrap.
 * Keep disabled during ordinary application operations.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.bootstrap.first-owner")
public class FirstOwnerBootstrapProperties {

    /**
     * Master switch for the first-owner bootstrap runner.
     * Must be explicitly set to true via APP_BOOTSTRAP_FIRST_OWNER_ENABLED.
     */
    private boolean enabled = false;

    /**
     * High-entropy bootstrap secret token (at least 32 characters).
     * Sourced from APP_BOOTSTRAP_FIRST_OWNER_SECRET. Never passed via CLI arguments or logged.
     */
    private String secret;
}

