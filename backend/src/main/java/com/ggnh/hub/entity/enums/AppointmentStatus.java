package com.ggnh.hub.entity.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum AppointmentStatus {
    PENDING("pending"),
    BOOKED("booked"),
    CONFIRMED("confirmed"),
    COMPLETED("completed"),
    CANCELLED("cancelled");

    private final String value;

    AppointmentStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static AppointmentStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (AppointmentStatus status : values()) {
            if (status.value.equalsIgnoreCase(value) || status.name().equalsIgnoreCase(value)) {
                return status;
            }
        }
        if ("pending".equalsIgnoreCase(value)) {
            return BOOKED;
        }
        throw new IllegalArgumentException("Unknown appointment status: " + value);
    }
}
