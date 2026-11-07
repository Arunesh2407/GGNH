package com.ggnh.hub.security.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Administrative ApplicationRunner for one-time first-owner bootstrap.
 * Dormant unless app.bootstrap.first-owner.enabled=true and --bootstrap-first-owner CLI switch is passed.
 * Reads the secret solely from environment variable APP_BOOTSTRAP_FIRST_OWNER_SECRET (never from CLI args).
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.bootstrap.first-owner", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class FirstOwnerBootstrapRunner implements ApplicationRunner {

    public static final String BOOTSTRAP_OPTION = "bootstrap-first-owner";
    private static final int MIN_SECRET_LENGTH = 32;

    private final FirstOwnerBootstrapProperties properties;
    private final FirstOwnerBootstrapService bootstrapService;

    @Override
    public void run(ApplicationArguments args) {
        // Gate 1: Check for explicit command-line switch --bootstrap-first-owner
        if (!args.containsOption(BOOTSTRAP_OPTION)) {
            log.debug("FirstOwnerBootstrapRunner: '--{}' switch not provided. Skipping bootstrap runner.", BOOTSTRAP_OPTION);
            return;
        }

        // Gate 2: Read secret ONLY from configuration/environment (never from CLI arguments)
        String secret = properties.getSecret();
        if (secret == null || secret.isBlank()) {
            secret = System.getenv("APP_BOOTSTRAP_FIRST_OWNER_SECRET");
        }

        validateSecret(secret);

        log.info("================================================================================");
        log.info("GGNH First-Owner Bootstrap: Initiating one-time administrative provisioning");
        log.info("================================================================================");

        try {
            BootstrapResult result = bootstrapService.executeBootstrap();
            log.info("Bootstrap execution finished with status: {}", result.getStatus());
            log.info("ACTION REQUIRED: Deactivate APP_BOOTSTRAP_FIRST_OWNER_ENABLED and unset APP_BOOTSTRAP_FIRST_OWNER_SECRET immediately.");
            log.info("================================================================================");
        } catch (Exception ex) {
            log.error("Bootstrap execution aborted due to error: {}", ex.getMessage());
            throw ex;
        }
    }

    private void validateSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new SecurityException("Bootstrap failed: APP_BOOTSTRAP_FIRST_OWNER_SECRET must be set and cannot be blank.");
        }

        String trimmedSecret = secret.trim();
        if (trimmedSecret.length() < MIN_SECRET_LENGTH) {
            throw new SecurityException("Bootstrap failed: APP_BOOTSTRAP_FIRST_OWNER_SECRET must be at least " + MIN_SECRET_LENGTH + " characters long.");
        }

        // Timing-safe check against known weak placeholder patterns
        String[] forbiddenPlaceholders = {"change-me", "default-secret", "secret-password", "replace-with-secure-secret", "your-bootstrap-secret"};
        for (String placeholder : forbiddenPlaceholders) {
            if (trimmedSecret.toLowerCase().contains(placeholder)) {
                throw new SecurityException("Bootstrap failed: APP_BOOTSTRAP_FIRST_OWNER_SECRET contains an insecure placeholder value.");
            }
        }
    }
}

