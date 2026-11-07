package com.ggnh.hub.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.AppointmentResponse;
import com.ggnh.hub.dto.CreateAppointmentRequest;
import com.ggnh.hub.dto.PagedAppointmentResponse;
import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.AppointmentIdempotency;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import com.ggnh.hub.repository.AppointmentIdempotencyRepository;
import com.ggnh.hub.repository.AppointmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final AppointmentIdempotencyRepository idempotencyRepository;
    private final AppointmentBookingTxService bookingTxService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    /**
     * Creates an appointment with mandatory idempotency key enforcement and transactional outbox persistence.
     * Guaranteed atomic: Appointment, Outbox, and Idempotency completion are committed in the same transaction.
     * Transaction rollback automatically cleans up any in-flight reservation.
     * Concurrent unique key conflicts are caught outside the rollback-only transaction scope and resolved safely.
     */
    public AppointmentResponse createAppointment(CreateAppointmentRequest request, String idempotencyKeyHeader) {
        if (idempotencyKeyHeader == null || idempotencyKeyHeader.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid UUID Idempotency-Key header is required");
        }

        UUID idempotencyKey;
        try {
            idempotencyKey = UUID.fromString(idempotencyKeyHeader.trim());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid UUID format for Idempotency-Key header");
        }

        String currentRequestHash = computeRequestHash(request);

        // 1. Check existing committed idempotency record
        Optional<AppointmentIdempotency> existing = idempotencyRepository.findById(idempotencyKey);
        if (existing.isPresent()) {
            return resolveExistingRecord(existing.get(), currentRequestHash, idempotencyKey);
        }

        // 2. Execute booking atomically in an isolated database transaction
        OffsetDateTime now = OffsetDateTime.now();
        try {
            AppointmentResponse response = bookingTxService.executeBooking(request, idempotencyKey, currentRequestHash, now);
            auditService.record(
                    request.getResolvedEmail() != null ? request.getResolvedEmail() : "guest",
                    "APPOINTMENT",
                    "APPOINTMENT_REQUESTED",
                    response.getId().toString(),
                    "Booked appointment for " + response.getName() + " with " + response.getDoctor()
            );
            return response;
        } catch (DataIntegrityViolationException ex) {
            // Concurrent race condition: Another thread/node with the same key committed.
            Optional<AppointmentIdempotency> raced = idempotencyRepository.findById(idempotencyKey);
            if (raced.isPresent()) {
                return resolveExistingRecord(raced.get(), currentRequestHash, idempotencyKey);
            }
            log.warn("Concurrent duplicate key collision for '{}'", idempotencyKey);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A booking request with this Idempotency-Key is currently in progress");
        }
    }

    private AppointmentResponse resolveExistingRecord(AppointmentIdempotency record, String currentRequestHash, UUID idempotencyKey) {
        if (record.getRequestHash() != null && !record.getRequestHash().equals(currentRequestHash)) {
            log.warn("Idempotency key '{}' reused with different request payload", idempotencyKey);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency-Key has already been used for a different appointment request");
        }

        if ("COMPLETED".equalsIgnoreCase(record.getStatus())) {
            log.info("Returning cached response for idempotency key '{}'", idempotencyKey);
            try {
                return objectMapper.readValue(record.getResponsePayload(), AppointmentResponse.class);
            } catch (JsonProcessingException ex) {
                log.error("Failed to deserialize cached response payload for idempotency key '{}'", idempotencyKey, ex);
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read cached appointment record");
            }
        } else {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A booking request with this Idempotency-Key is currently in progress");
        }
    }

    /**
     * Computes unambiguous, deterministic canonical SHA-256 fingerprint of normalized request fields.
     */
    public String computeRequestHash(CreateAppointmentRequest request) {
        Map<String, String> canonical = new TreeMap<>();
        canonical.put("doctor", normalize(request.getResolvedDoctor()));
        canonical.put("email", normalizeEmail(request.getResolvedEmail()));
        canonical.put("message", normalize(request.getResolvedMessage()));
        canonical.put("name", normalize(request.getResolvedName()));
        canonical.put("phone", normalize(request.getResolvedPhone()));
        if (request.getAppointmentDate() != null) {
            canonical.put("date", request.getAppointmentDate().toString());
        }
        if (request.getTimeSlot() != null) {
            canonical.put("slot", request.getTimeSlot().trim());
        }

        try {
            byte[] canonicalBytes = objectMapper.writeValueAsBytes(canonical);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonicalBytes);
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to compute deterministic request fingerprint", ex);
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Lists appointments with pagination, optional status filter, search, and date filters.
     */
    @Transactional(readOnly = true)
    public PagedAppointmentResponse getAppointments(int page, int size, String statusFilter) {
        return getAppointments(page, size, statusFilter, null, null, null);
    }

    @Transactional(readOnly = true)
    public PagedAppointmentResponse getAppointments(int page, int size, String statusFilter, String search, String startDate, String endDate) {
        int boundedPage = Math.max(0, page);
        int boundedSize = Math.min(100, Math.max(1, size));

        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(
                Sort.Order.desc("createdAt"),
                Sort.Order.desc("id")
        ));

        AppointmentStatus status = null;
        if (statusFilter != null && !statusFilter.trim().isEmpty()) {
            try {
                status = AppointmentStatus.fromValue(statusFilter.trim());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid appointment status filter: " + statusFilter);
            }
        }

        LocalDate start = (startDate != null && !startDate.isBlank()) ? LocalDate.parse(startDate.trim()) : null;
        LocalDate end = (endDate != null && !endDate.isBlank()) ? LocalDate.parse(endDate.trim()) : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        Page<Appointment> pageResult;
        if (cleanSearch != null || start != null || end != null) {
            pageResult = appointmentRepository.searchAppointments(cleanSearch, status, start, end, pageable);
        } else if (status != null) {
            pageResult = appointmentRepository.findByStatusOrderByCreatedAtDescIdDesc(status, pageable);
        } else {
            pageResult = appointmentRepository.findAllByOrderByCreatedAtDescIdDesc(pageable);
        }

        List<AppointmentResponse> content = pageResult.getContent().stream()
                .map(this::toResponse)
                .toList();

        return PagedAppointmentResponse.builder()
                .content(content)
                .page(pageResult.getNumber())
                .size(pageResult.getSize())
                .totalElements(pageResult.getTotalElements())
                .totalPages(pageResult.getTotalPages())
                .last(pageResult.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public AppointmentResponse getAppointmentById(UUID id) {
        return appointmentRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getAppointmentsByPatientEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Collections.emptyList();
        }
        return appointmentRepository.findByPatientEmailIgnoreCaseOrderByCreatedAtDesc(email.trim()).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Transitions appointment to CONFIRMED.
     */
    @Transactional
    public AppointmentResponse confirmAppointment(UUID id, String actor) {
        Appointment existing = appointmentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found with id: " + id));

        if (existing.getStatus() == AppointmentStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot confirm a cancelled appointment");
        }
        if (existing.getStatus() == AppointmentStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot confirm an already completed appointment");
        }

        existing.setStatus(AppointmentStatus.CONFIRMED);
        existing.setUpdatedAt(OffsetDateTime.now());
        Appointment updated = appointmentRepository.save(existing);
        auditService.record(actor, "APPOINTMENT", "APPOINTMENT_CONFIRMED", id.toString(), "Confirmed appointment for " + updated.getPatientName());
        log.info("Appointment {} confirmed by {}", id, actor);
        return toResponse(updated);
    }

    /**
     * Transitions appointment to CANCELLED.
     */
    @Transactional
    public AppointmentResponse cancelAppointment(UUID id, String actor, boolean isStaff) {
        Appointment existing = appointmentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found with id: " + id));

        if (existing.getStatus() == AppointmentStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot cancel an appointment that is already completed");
        }
        if (existing.getStatus() == AppointmentStatus.CANCELLED) {
            return toResponse(existing);
        }

        // If patient self-cancelling, verify identity
        if (!isStaff) {
            if (existing.getPatientEmail() == null || !existing.getPatientEmail().equalsIgnoreCase(actor.trim())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not authorized to cancel this appointment");
            }
        }

        existing.setStatus(AppointmentStatus.CANCELLED);
        existing.setUpdatedAt(OffsetDateTime.now());
        Appointment updated = appointmentRepository.save(existing);
        auditService.record(actor, "APPOINTMENT", "APPOINTMENT_CANCELLED", id.toString(), "Cancelled appointment for " + updated.getPatientName());
        log.info("Appointment {} cancelled by {}", id, actor);
        return toResponse(updated);
    }

    /**
     * Transitions appointment to COMPLETED.
     */
    @Transactional
    public AppointmentResponse markCompleted(UUID id) {
        return markCompleted(id, "Staff");
    }

    @Transactional
    public AppointmentResponse markCompleted(UUID id, String actor) {
        Appointment existing = appointmentRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found with id: " + id));

        if (existing.getStatus() == AppointmentStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot complete an appointment that is already cancelled");
        }

        if (existing.getStatus() != AppointmentStatus.COMPLETED) {
            OffsetDateTime now = OffsetDateTime.now();
            existing.setStatus(AppointmentStatus.COMPLETED);
            existing.setCompletedAt(now);
            existing.setUpdatedAt(now);
            Appointment updated = appointmentRepository.save(existing);
            auditService.record(actor, "APPOINTMENT", "APPOINTMENT_COMPLETED", id.toString(), "Completed appointment for " + updated.getPatientName());
            log.info("Appointment {} transitioned to COMPLETED by {}", id, actor);
            return toResponse(updated);
        }

        return toResponse(existing);
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
}
