package com.ggnh.hub.security.bootstrap;

import lombok.Value;

import java.util.UUID;

@Value
public class BootstrapResult {
    public enum Status {
        CREATED,
        ALREADY_PROVISIONED
    }

    Status status;
    UUID userId;

    public static BootstrapResult created(UUID userId) {
        return new BootstrapResult(Status.CREATED, userId);
    }

    public static BootstrapResult alreadyProvisioned(UUID userId) {
        return new BootstrapResult(Status.ALREADY_PROVISIONED, userId);
    }
}

