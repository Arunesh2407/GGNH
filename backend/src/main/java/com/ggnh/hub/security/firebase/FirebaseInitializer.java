package com.ggnh.hub.security.firebase;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class FirebaseInitializer {

    private final FirebaseProperties properties;

    @Getter
    private FirebaseApp firebaseApp;

    @Getter
    private boolean initialized = false;

    @PostConstruct
    public void initialize() {
        if (!properties.isEnabled()) {
            log.info("Firebase integration is explicitly disabled via configuration.");
            return;
        }

        // Avoid multiple initializations if already present
        if (!FirebaseApp.getApps().isEmpty()) {
            this.firebaseApp = FirebaseApp.getInstance();
            this.initialized = true;
            log.info("FirebaseApp was already initialized (app name: {}). Reusing existing instance.", firebaseApp.getName());
            return;
        }

        try {
            GoogleCredentials credentials = resolveCredentials();
            if (credentials == null) {
                log.warn("No Firebase service account credentials found. " +
                        "Firebase authentication will fail for incoming bearer tokens unless mock verifier is configured.");
                return;
            }

            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                    .setCredentials(credentials);

            if (properties.getProjectId() != null && !properties.getProjectId().isBlank()) {
                builder.setProjectId(properties.getProjectId());
            }

            this.firebaseApp = FirebaseApp.initializeApp(builder.build());
            this.initialized = true;
            log.info("Firebase Admin SDK successfully initialized for project: {}", properties.getProjectId() != null ? properties.getProjectId() : "default");
        } catch (Exception e) {
            log.warn("Failed to initialize Firebase Admin SDK: {}. Safe fallback active (API will run but token verification will fail safely).", e.getMessage());
        }
    }

    private GoogleCredentials resolveCredentials() {
        // 1. Raw JSON string in configuration or env var
        if (properties.getCredentialsJson() != null && !properties.getCredentialsJson().isBlank()) {
            try (InputStream stream = new ByteArrayInputStream(properties.getCredentialsJson().getBytes(StandardCharsets.UTF_8))) {
                log.info("Loading Firebase credentials from configured credentials JSON.");
                return GoogleCredentials.fromStream(stream);
            } catch (Exception e) {
                log.warn("Failed to parse Firebase credentials JSON: {}", e.getMessage());
            }
        }

        // 2. Explicit file path
        if (properties.getConfigPath() != null && !properties.getConfigPath().isBlank()) {
            try (InputStream stream = new FileInputStream(properties.getConfigPath())) {
                log.info("Loading Firebase credentials from file path: {}", properties.getConfigPath());
                return GoogleCredentials.fromStream(stream);
            } catch (Exception e) {
                log.warn("Failed to load Firebase credentials from file '{}': {}", properties.getConfigPath(), e.getMessage());
            }
        }

        // 3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or cloud metadata)
        try {
            log.info("Attempting to load Firebase credentials via Application Default Credentials (ADC)...");
            return GoogleCredentials.getApplicationDefault();
        } catch (Exception e) {
            log.debug("Application Default Credentials not available: {}", e.getMessage());
        }

        return null;
    }
}
