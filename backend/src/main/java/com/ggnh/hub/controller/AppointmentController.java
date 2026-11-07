package com.ggnh.hub.controller;

import com.ggnh.hub.dto.AppointmentResponse;
import com.ggnh.hub.dto.CreateAppointmentRequest;
import com.ggnh.hub.dto.PagedAppointmentResponse;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.service.AppointmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;

    @PostMapping
    public ResponseEntity<AppointmentResponse> createAppointment(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateAppointmentRequest request
    ) {
        AppointmentResponse response = appointmentService.createAppointment(request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AppointmentResponse>> getMyAppointments(
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        if (principal == null || principal.getEmail() == null || principal.getEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user email is required");
        }
        return ResponseEntity.ok(appointmentService.getAppointmentsByPatientEmail(principal.getEmail()));
    }

    @GetMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")
    public ResponseEntity<PagedAppointmentResponse> getAppointments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        PagedAppointmentResponse response = appointmentService.getAppointments(page, size, status, search, startDate, endDate);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")
    public ResponseEntity<AppointmentResponse> getAppointmentById(@PathVariable UUID id) {
        AppointmentResponse response = appointmentService.getAppointmentById(id);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/confirm")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")
    public ResponseEntity<AppointmentResponse> confirmAppointment(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        AppointmentResponse response = appointmentService.confirmAppointment(id, actor);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/complete")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")
    public ResponseEntity<AppointmentResponse> markCompleted(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Staff";
        AppointmentResponse response = appointmentService.markCompleted(id, actor);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable UUID id,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        if (principal == null || principal.getEmail() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user email is required");
        }
        boolean isStaff = principal.getAuthorities().stream().anyMatch(a ->
                "ROLE_owner".equalsIgnoreCase(a.getAuthority()) ||
                "PERM_MANAGE_APPOINTMENTS".equalsIgnoreCase(a.getAuthority())
        );

        AppointmentResponse response = appointmentService.cancelAppointment(id, principal.getEmail(), isStaff);
        return ResponseEntity.ok(response);
    }
}
