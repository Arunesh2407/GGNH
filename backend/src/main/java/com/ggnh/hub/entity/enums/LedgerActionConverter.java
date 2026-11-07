package com.ggnh.hub.entity.enums;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class LedgerActionConverter implements AttributeConverter<LedgerAction, String> {

    @Override
    public String convertToDatabaseColumn(LedgerAction attribute) {
        return attribute == null ? null : attribute.getValue();
    }

    @Override
    public LedgerAction convertToEntityAttribute(String dbData) {
        return dbData == null ? null : LedgerAction.fromValue(dbData);
    }
}

