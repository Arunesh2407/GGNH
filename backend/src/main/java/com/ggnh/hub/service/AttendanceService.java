package com.ggnh.hub.service;

import com.ggnh.hub.dto.AttendanceRecordResponse;
import com.ggnh.hub.dto.MarkAttendanceRequest;
import com.ggnh.hub.entity.Attendance;
import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.entity.enums.AttendanceStatus;
import com.ggnh.hub.repository.AttendanceRepository;
import com.ggnh.hub.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final StaffRepository staffRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public Map<String, Map<String, String>> getAttendance(String date) {
        List<Attendance> records;
        if (date != null && !date.isBlank()) {
            LocalDate localDate = LocalDate.parse(date.trim());
            records = attendanceRepository.findByAttendanceDate(localDate);
        } else {
            records = attendanceRepository.findAll();
        }

        Map<String, Map<String, String>> result = new HashMap<>();
        for (Attendance record : records) {
            String dateKey = record.getDate();
            String staffKey = record.getStaffId() != null ? record.getStaffId().toString() : "";
            String statusValue = record.getStatus() != null ? record.getStatus().getValue() : "";

            result.computeIfAbsent(dateKey, k -> new HashMap<>())
                  .put(staffKey, statusValue);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> getDetailedRecords(String date, UUID staffId, String startDate, String endDate) {
        List<Attendance> records;

        if (date != null && !date.isBlank()) {
            LocalDate localDate = LocalDate.parse(date.trim());
            records = attendanceRepository.findByAttendanceDate(localDate);
        } else if (staffId != null && startDate != null && endDate != null) {
            records = attendanceRepository.findByStaff_IdAndAttendanceDateBetweenOrderByAttendanceDateDesc(
                    staffId, LocalDate.parse(startDate.trim()), LocalDate.parse(endDate.trim())
            );
        } else if (staffId != null) {
            records = attendanceRepository.findByStaff_IdOrderByAttendanceDateDesc(staffId);
        } else if (startDate != null && endDate != null) {
            records = attendanceRepository.findByAttendanceDateBetweenOrderByAttendanceDateDesc(
                    LocalDate.parse(startDate.trim()), LocalDate.parse(endDate.trim())
            );
        } else {
            records = attendanceRepository.findAll();
        }

        return records.stream()
                .map(this::toRecordResponse)
                .toList();
    }

    @Transactional
    public Attendance checkIn(UUID staffId, String actor) {
        LocalDate today = LocalDate.now();
        Staff staff = staffRepository.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found: " + staffId));

        Optional<Attendance> existing = attendanceRepository.findByStaff_IdAndAttendanceDate(staffId, today);
        if (existing.isPresent()) {
            Attendance att = existing.get();
            if (att.getCheckInTime() != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Staff member already checked in today at " + att.getCheckInTime());
            }
            att.setCheckInTime(OffsetDateTime.now());
            att.setStatus(AttendanceStatus.PRESENT);
            Attendance saved = attendanceRepository.save(att);
            auditService.record(actor, "ATTENDANCE", "CHECK_IN", saved.getId().toString(), "Staff " + staff.getName() + " checked in");
            return saved;
        }

        Attendance attendance = Attendance.builder()
                .staff(staff)
                .attendanceDate(today)
                .status(AttendanceStatus.PRESENT)
                .checkInTime(OffsetDateTime.now())
                .build();

        Attendance saved = attendanceRepository.save(attendance);
        auditService.record(actor, "ATTENDANCE", "CHECK_IN", saved.getId().toString(), "Staff " + staff.getName() + " checked in");
        log.info("Staff '{}' checked in today", staff.getName());
        return saved;
    }

    @Transactional
    public Attendance checkOut(UUID staffId, String actor) {
        LocalDate today = LocalDate.now();
        Staff staff = staffRepository.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found: " + staffId));

        Attendance attendance = attendanceRepository.findByStaff_IdAndAttendanceDate(staffId, today)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot check out: No check-in record found for today"));

        if (attendance.getCheckOutTime() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Staff member already checked out today at " + attendance.getCheckOutTime());
        }

        attendance.setCheckOutTime(OffsetDateTime.now());
        Attendance saved = attendanceRepository.save(attendance);
        auditService.record(actor, "ATTENDANCE", "CHECK_OUT", saved.getId().toString(), "Staff " + staff.getName() + " checked out");
        log.info("Staff '{}' checked out today", staff.getName());
        return saved;
    }

    @Transactional
    public Attendance markAttendance(MarkAttendanceRequest request, String actor) {
        LocalDate localDate = LocalDate.parse(request.getDate());
        AttendanceStatus status = AttendanceStatus.fromValue(request.getStatus());

        Optional<Attendance> existingOpt = attendanceRepository.findByStaff_IdAndAttendanceDate(request.getStaffId(), localDate);

        Attendance attendance;
        boolean isCorrection = existingOpt.isPresent();

        if (isCorrection) {
            attendance = existingOpt.get();
            attendance.setStatus(status);
            attendance.setCorrectedBy(actor);
            attendance.setCorrectedAt(OffsetDateTime.now());
            if (request.getNotes() != null && !request.getNotes().isBlank()) {
                attendance.setNotes(request.getNotes().trim());
            }
        } else {
            Staff staff = staffRepository.findById(request.getStaffId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Staff member not found: " + request.getStaffId()
                    ));
            attendance = Attendance.builder()
                    .staff(staff)
                    .attendanceDate(localDate)
                    .status(status)
                    .notes(request.getNotes() != null ? request.getNotes().trim() : null)
                    .build();
        }

        Attendance saved = attendanceRepository.save(attendance);
        String action = isCorrection ? "ATTENDANCE_CORRECTED" : "ATTENDANCE_MARKED";
        auditService.record(
                actor,
                "ATTENDANCE",
                action,
                saved.getId().toString(),
                "Marked " + saved.getStatus() + " for staff on " + localDate
        );
        log.info("Marked attendance for staff ID {} on {} as {} by {}", request.getStaffId(), localDate, status, actor);
        return saved;
    }

    @Transactional
    public void clearAttendance(String date, UUID staffId, String actor) {
        LocalDate localDate = LocalDate.parse(date);
        attendanceRepository.deleteByAttendanceDateAndStaff_Id(localDate, staffId);
        auditService.record(
                actor,
                "ATTENDANCE",
                "ATTENDANCE_CLEARED",
                staffId.toString(),
                "Cleared attendance on " + localDate
        );
        log.info("Cleared attendance for staff ID {} on {} by {}", staffId, localDate, actor);
    }

    public AttendanceRecordResponse toRecordResponse(Attendance att) {
        return AttendanceRecordResponse.builder()
                .id(att.getId())
                .staffId(att.getStaffId())
                .staffName(att.getStaffName())
                .staffRole(att.getStaff() != null ? att.getStaff().getRole() : null)
                .attendanceDate(att.getAttendanceDate())
                .status(att.getStatus())
                .checkInTime(att.getCheckInTime())
                .checkOutTime(att.getCheckOutTime())
                .notes(att.getNotes())
                .correctedBy(att.getCorrectedBy())
                .correctedAt(att.getCorrectedAt())
                .recordedAt(att.getRecordedAt())
                .build();
    }
}
