package com.ggnh.hub.entity;

import org.hibernate.annotations.IdGeneratorType;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation for generating a random UUID if id is null, or preserving the assigned UUID if provided.
 */
@IdGeneratorType(AssignedOrRandomUuidGenerator.class)
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.METHOD})
public @interface AssignedOrRandomUuid {
}

