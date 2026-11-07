package com.ggnh.hub.entity;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.generator.BeforeExecutionGenerator;
import org.hibernate.generator.EventType;
import org.hibernate.generator.GeneratorCreationContext;

import java.lang.reflect.Member;
import java.util.EnumSet;
import java.util.UUID;

/**
 * Custom Hibernate 6 BeforeExecutionGenerator that preserves assigned UUIDs if already present,
 * or generates a new random UUID if the field is null.
 */
public class AssignedOrRandomUuidGenerator implements BeforeExecutionGenerator {

    public AssignedOrRandomUuidGenerator() {
    }

    public AssignedOrRandomUuidGenerator(AssignedOrRandomUuid config, Member member, GeneratorCreationContext context) {
    }

    @Override
    public Object generate(SharedSessionContractImplementor session, Object owner, Object currentValue, EventType eventType) {
        if (currentValue != null) {
            return currentValue;
        }
        if (owner instanceof Appointment appointment && appointment.getId() != null) {
            return appointment.getId();
        }
        return UUID.randomUUID();
    }

    @Override
    public EnumSet<EventType> getEventTypes() {
        return EnumSet.of(EventType.INSERT);
    }
}
