package com.ggnh.hub.controller;

import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.repository.AppointmentRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentRepository appointmentRepository;

    @GetMapping
    public ResponseEntity<Page<Appointment>> getAppointments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Appointment> result = (status != null && !status.isBlank())
                ? appointmentRepository.findByStatusOrderByCreatedAtDesc(status, pageable)
                : appointmentRepository.findAllByOrderByCreatedAtDesc(pageable);

        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Appointment> createAppointment(@Valid @RequestBody Appointment appointment) {
        Appointment saved = appointmentRepository.save(appointment);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PatchMapping("/{id}/complete")
    public ResponseEntity<Appointment> markCompleted(@PathVariable String id) {
        return appointmentRepository.findById(id)
                .map(existing -> {
                    existing.setStatus("completed");
                    existing.setCompletedAt(LocalDateTime.now());
                    return ResponseEntity.ok(appointmentRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
