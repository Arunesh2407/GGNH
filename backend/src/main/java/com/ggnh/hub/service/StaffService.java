package com.ggnh.hub.service;

import com.ggnh.hub.entity.Staff;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.repository.AttendanceRepository;
import com.ggnh.hub.repository.StaffRepository;
import com.ggnh.hub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StaffService {

    private final StaffRepository staffRepository;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<Staff> getAllStaff() {
        return staffRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Staff> searchStaff(String search, String role, String department, Boolean isActive) {
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String cleanRole = (role != null && !role.isBlank()) ? role.trim() : null;
        String cleanDepartment = (department != null && !department.isBlank()) ? department.trim() : null;

        return staffRepository.searchStaff(cleanSearch, cleanRole, cleanDepartment, isActive);
    }

    @Transactional(readOnly = true)
    public Optional<Staff> getStaffById(UUID id) {
        return staffRepository.findById(id);
    }

    @Transactional
    public Staff createStaff(Staff staff, String actor) {
        if (staff.getEmail() != null && !staff.getEmail().isBlank()) {
            userRepository.findByEmailIgnoreCase(staff.getEmail().trim())
                    .ifPresent(staff::setUser);
        }

        Staff saved = staffRepository.save(staff);
        auditService.record(
                actor,
                "STAFF",
                "STAFF_CREATED",
                saved.getId().toString(),
                "Created staff: " + saved.getName() + " (" + saved.getRole() + ")"
        );
        log.info("Created staff member: {} by {}", saved.getName(), actor);
        return saved;
    }

    @Transactional
    public Optional<Staff> updateStaff(UUID id, Staff staffDetails, String actor) {
        return staffRepository.findById(id).map(existing -> {
            existing.setName(staffDetails.getName());
            existing.setRole(staffDetails.getRole());
            existing.setPhone(staffDetails.getPhone());
            existing.setEmail(staffDetails.getEmail());
            existing.setDesignation(staffDetails.getDesignation());
            existing.setDepartment(staffDetails.getDepartment());
            existing.setEmploymentStatus(staffDetails.getEmploymentStatus());
            existing.setJoiningDate(staffDetails.getJoiningDate());
            existing.setActive(staffDetails.isActive());

            if (existing.getEmail() != null && !existing.getEmail().isBlank() && existing.getUser() == null) {
                userRepository.findByEmailIgnoreCase(existing.getEmail().trim())
                        .ifPresent(existing::setUser);
            }

            Staff updated = staffRepository.save(existing);
            auditService.record(
                    actor,
                    "STAFF",
                    "STAFF_UPDATED",
                    id.toString(),
                    "Updated staff profile for: " + updated.getName()
            );
            log.info("Updated staff member '{}' (ID: {}) by {}", updated.getName(), id, actor);
            return updated;
        });
    }

    @Transactional
    public Optional<Staff> toggleStaffStatus(UUID id, boolean isActive, String actor) {
        return staffRepository.findById(id).map(existing -> {
            existing.setActive(isActive);
            Staff updated = staffRepository.save(existing);
            auditService.record(
                    actor,
                    "STAFF",
                    "STAFF_STATUS_CHANGED",
                    id.toString(),
                    "Set active=" + isActive + " for staff: " + updated.getName()
            );
            log.info("Updated staff status '{}' (ID: {}) to active={} by {}", updated.getName(), id, isActive, actor);
            return updated;
        });
    }

    @Transactional
    public Optional<Staff> linkStaffUser(UUID staffId, UUID userId, String actor) {
        return staffRepository.findById(staffId).map(staff -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
            staff.setUser(user);
            Staff updated = staffRepository.save(staff);
            auditService.record(
                    actor,
                    "STAFF",
                    "STAFF_USER_LINKED",
                    staffId.toString(),
                    "Linked staff " + staff.getName() + " to user account " + user.getEmail()
            );
            return updated;
        });
    }

    @Transactional
    public boolean deleteStaff(UUID id, String actor) {
        Optional<Staff> staffOpt = staffRepository.findById(id);
        if (staffOpt.isEmpty()) {
            return false;
        }
        Staff staff = staffOpt.get();
        attendanceRepository.deleteByStaff_Id(id);
        staffRepository.deleteById(id);
        auditService.record(
                actor,
                "STAFF",
                "STAFF_DELETED",
                id.toString(),
                "Deleted staff: " + staff.getName()
        );
        log.info("Deleted staff member ID: {} by {}", id, actor);
        return true;
    }
}
