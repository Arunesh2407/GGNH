package com.ggnh.hub.controller;

import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.repository.AttendanceRepository;
import com.ggnh.hub.repository.StaffRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffRepository staffRepository;
    private final AttendanceRepository attendanceRepository;

    @GetMapping
    public ResponseEntity<List<Staff>> getAllStaff() {
        return ResponseEntity.ok(staffRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Staff> getStaffById(@PathVariable String id) {
        return staffRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Staff> createStaff(@Valid @RequestBody Staff staff) {
        Staff saved = staffRepository.save(staff);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Staff> updateStaff(@PathVariable String id, @Valid @RequestBody Staff staffDetails) {
        return staffRepository.findById(id)
                .map(existingStaff -> {
                    existingStaff.setName(staffDetails.getName());
                    existingStaff.setRole(staffDetails.getRole());
                    existingStaff.setPhone(staffDetails.getPhone());
                    existingStaff.setEmail(staffDetails.getEmail());
                    return ResponseEntity.ok(staffRepository.save(existingStaff));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteStaff(@PathVariable String id) {
        if (!staffRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        attendanceRepository.deleteByStaffId(id);
        staffRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
