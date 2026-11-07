package com.ggnh.hub.security.firebase;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.firebase")
public class FirebaseProperties {

    /**
     * Whether Firebase initialization and token verification is enabled.
     */
    private boolean enabled = true;

    /**
     * Optional file path to service account JSON credentials.
     */
    private String configPath;

    /**
     * Optional raw JSON content of service account credentials (useful for secret managers / env vars).
     */
    private String credentialsJson;

    /**
     * Whether to check token revocation against Firebase on each request.
     * Default false for stateless high-throughput API.
     */
    private boolean checkRevoked = false;

    /**
     * Optional Firebase Project ID.
     */
    private String projectId;
}
