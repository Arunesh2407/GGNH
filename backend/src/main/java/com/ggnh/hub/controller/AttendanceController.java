package com.ggnh.hub.controller;

import com.ggnh.hub.entity.Attendance;
import com.ggnh.hub.repository.AttendanceRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;

    @GetMapping
    public ResponseEntity<Map<String, Map<String, String>>> getAllAttendance(
            @RequestParam(required = false) String date
    ) {
        List<Attendance> records = (date != null && !date.isBlank())
                ? attendanceRepository.findByDate(date)
                : attendanceRepository.findAll();

        Map<String, Map<String, String>> result = new HashMap<>();
        for (Attendance record : records) {
            result.computeIfAbsent(record.getDate(), k -> new HashMap<>())
                  .put(record.getStaffId(), record.getStatus());
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/mark")
    public ResponseEntity<Attendance> markAttendance(@Valid @RequestBody Attendance attendance) {
        String docId = attendance.getDate() + "_" + attendance.getStaffId();
        attendance.setId(docId);
        Attendance saved = attendanceRepository.save(attendance);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping
    @Transactional
    public ResponseEntity<Void> clearAttendance(
            @RequestParam String date,
            @RequestParam String staffId
    ) {
        attendanceRepository.deleteByDateAndStaffId(date, staffId);
        return ResponseEntity.noContent().build();
    }
}
