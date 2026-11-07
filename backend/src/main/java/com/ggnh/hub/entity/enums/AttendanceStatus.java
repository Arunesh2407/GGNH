package com.ggnh.hub.entity.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum AttendanceStatus {
    PRESENT("present"),
    ABSENT("absent"),
    LEAVE("leave"),
    OFF("off"),
    HALF_TIME("half-time"),
    OVER_TIME("over-time");

    private final String value;

    AttendanceStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static AttendanceStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (AttendanceStatus status : values()) {
            if (status.value.equalsIgnoreCase(value) || status.name().equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown attendance status: " + value);
    }
}

