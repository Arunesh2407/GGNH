package com.ggnh.hub.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.AppointmentResponse;
import com.ggnh.hub.dto.CreateAppointmentRequest;
import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.AppointmentIdempotency;
import com.ggnh.hub.entity.AppointmentOutbox;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.repository.AppointmentIdempotencyRepository;
import com.ggnh.hub.repository.AppointmentOutboxRepository;
import com.ggnh.hub.repository.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Isolated transactional service executing the atomic booking operations.
 * Ensures:
 * 1. Appointment, Outbox, and Idempotency completion are committed in ONE atomic transaction.
 * 2. If any failure occurs, PostgreSQL rolls back the entire transaction, leaving zero stuck reservations.
 * 3. Concurrent unique key collisions fail at the database level and are caught outside this transaction boundary.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentBookingTxService {

    private final AppointmentRepository appointmentRepository;
    private final AppointmentOutboxRepository outboxRepository;
    private final AppointmentIdempotencyRepository idempotencyRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AppointmentResponse executeBooking(CreateAppointmentRequest request,
                                              UUID idempotencyKey,
                                              String requestHash,
                                              OffsetDateTime now) {
        // 1. Construct and save Appointment domain entity
        Appointment appointment = Appointment.builder()
                .patientName(request.getResolvedName())
                .patientPhone(request.getResolvedPhone())
                .patientEmail(request.getResolvedEmail())
                .doctorName(request.getResolvedDoctor())
                .message(request.getResolvedMessage())
                .appointmentDate(request.getAppointmentDate())
                .timeSlot(request.getTimeSlot())
                .status(AppointmentStatus.BOOKED)
                .createdAt(now)
                .updatedAt(now)
                .completedAt(null)
                .build();

        Appointment saved = appointmentRepository.save(appointment);

        // 2. Construct and save Transactional Outbox event
        Map<String, Object> outboxPayload = new LinkedHashMap<>();
        outboxPayload.put("appointmentId", saved.getId().toString());
        outboxPayload.put("patientName", saved.getPatientName());
        outboxPayload.put("doctorName", saved.getDoctorName());
        outboxPayload.put("phoneMasked", maskPhone(saved.getPatientPhone()));
        outboxPayload.put("email", maskEmail(saved.getPatientEmail()));
        outboxPayload.put("createdAt", saved.getCreatedAt().toString());

        String serializedPayload;
        try {
            serializedPayload = objectMapper.writeValueAsString(outboxPayload);
        } catch (JsonProcessingException ex) {
            serializedPayload = "{}";
        }

        AppointmentOutbox outbox = AppointmentOutbox.builder()
                .appointmentId(saved.getId())
                .eventType("APPOINTMENT_REQUESTED")
                .channel("EMAIL")
                .payload(serializedPayload)
                .status("PENDING")
                .attempts(0)
                .maxAttempts(5)
                .nextAttemptAt(now)
                .createdAt(now)
                .build();

        outboxRepository.save(outbox);

        // 3. Construct and save Idempotency record with status = COMPLETED
        AppointmentResponse response = toResponse(saved);
        String responseJson;
        try {
            responseJson = objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException ex) {
            throw new RuntimeException("Failed to serialize response payload for idempotency", ex);
        }

        AppointmentIdempotency idempotency = AppointmentIdempotency.builder()
                .key(idempotencyKey)
                .appointmentId(saved.getId())
                .requestHash(requestHash)
                .status("COMPLETED")
                .responsePayload(responseJson)
                .createdAt(now)
                .expiresAt(now.plusHours(24))
                .build();

        // Flushes to enforce unique constraint on idempotency_key within this transaction
        idempotencyRepository.saveAndFlush(idempotency);

        return response;
    }

    public AppointmentResponse toResponse(Appointment appointment) {
        return AppointmentResponse.builder()
                .id(appointment.getId())
                .name(appointment.getPatientName())
                .phone(appointment.getPatientPhone())
                .email(appointment.getPatientEmail())
                .doctor(appointment.getDoctorName())
                .message(appointment.getMessage())
                .appointmentDate(appointment.getAppointmentDate())
                .timeSlot(appointment.getTimeSlot())
                .status(appointment.getStatus())
                .createdAt(appointment.getCreatedAt())
                .completedAt(appointment.getCompletedAt())
                .updatedAt(appointment.getUpdatedAt())
                .build();
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return "***";
        }
        String trimmed = phone.trim();
        if (trimmed.length() <= 4) {
            return "***";
        }
        return trimmed.substring(0, Math.min(3, trimmed.length())) + "******" + trimmed.substring(trimmed.length() - Math.min(4, trimmed.length()));
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "***";
        }
        int atIdx = email.indexOf('@');
        if (atIdx <= 1) {
            return "***" + email.substring(Math.max(0, atIdx));
        }
        return email.charAt(0) + "***" + email.charAt(atIdx - 1) + email.substring(atIdx);
    }
}
