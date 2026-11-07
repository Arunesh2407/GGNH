package com.ggnh.hub.controller;

import com.ggnh.hub.dto.AttendanceRecordResponse;
import com.ggnh.hub.dto.MarkAttendanceRequest;
import com.ggnh.hub.entity.Attendance;
import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.repository.StaffRepository;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.service.AttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final StaffRepository staffRepository;

    @GetMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")
    public ResponseEntity<Map<String, Map<String, String>>> getAllAttendance(
            @RequestParam(required = false) String date
    ) {
        return ResponseEntity.ok(attendanceService.getAttendance(date));
    }

    @GetMapping("/records")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")
    public ResponseEntity<List<AttendanceRecordResponse>> getDetailedRecords(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) UUID staffId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        return ResponseEntity.ok(attendanceService.getDetailedRecords(date, staffId, startDate, endDate));
    }

    @PostMapping("/check-in")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AttendanceRecordResponse> checkIn(
            @RequestParam(required = false) UUID staffId,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        UUID effectiveStaffId = resolveStaffId(staffId, principal);
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Self";
        Attendance attendance = attendanceService.checkIn(effectiveStaffId, actor);
        return ResponseEntity.ok(attendanceService.toRecordResponse(attendance));
    }

    @PostMapping("/check-out")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AttendanceRecordResponse> checkOut(
            @RequestParam(required = false) UUID staffId,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        UUID effectiveStaffId = resolveStaffId(staffId, principal);
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Self";
        Attendance attendance = attendanceService.checkOut(effectiveStaffId, actor);
        return ResponseEntity.ok(attendanceService.toRecordResponse(attendance));
    }

    @PostMapping("/mark")
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")
    public ResponseEntity<AttendanceRecordResponse> markAttendance(
            @Valid @RequestBody MarkAttendanceRequest request,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        Attendance attendance = attendanceService.markAttendance(request, actor);
        return ResponseEntity.ok(attendanceService.toRecordResponse(attendance));
    }

    @DeleteMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")
    public ResponseEntity<Void> clearAttendance(
            @RequestParam String date,
            @RequestParam UUID staffId,
            @AuthenticationPrincipal FirebaseUserDetails principal
    ) {
        String actor = (principal != null && principal.getEmail() != null) ? principal.getEmail() : "Admin";
        attendanceService.clearAttendance(date, staffId, actor);
        return ResponseEntity.noContent().build();
    }

    private UUID resolveStaffId(UUID requestedStaffId, FirebaseUserDetails principal) {
        if (requestedStaffId != null) {
            return requestedStaffId;
        }
        if (principal == null || principal.getEmail() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated session");
        }
        Optional<Staff> staff = staffRepository.findByEmailIgnoreCase(principal.getEmail().trim());
        if (staff.isEmpty() && principal.getId() != null) {
            staff = staffRepository.findByUser_Id(principal.getId());
        }
        return staff.map(Staff::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No staff profile associated with current user account: " + principal.getEmail()));
    }
}
