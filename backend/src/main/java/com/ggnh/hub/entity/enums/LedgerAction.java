package com.ggnh.hub.entity.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum LedgerAction {
    RECEIVE("receive"),
    ISSUE("issue"),
    ADJUST("adjust"),
    WASTE("waste"),
    RETURN("return");

    private final String value;

    LedgerAction(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static LedgerAction fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (LedgerAction action : values()) {
            if (action.value.equalsIgnoreCase(value) || action.name().equalsIgnoreCase(value)) {
                return action;
            }
        }
        throw new IllegalArgumentException("Unknown ledger action: " + value);
    }
}

