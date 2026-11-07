package com.ggnh.hub.repository;

import com.ggnh.hub.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    List<Attendance> findByAttendanceDate(LocalDate attendanceDate);
    List<Attendance> findByStaff_Id(UUID staffId);
    List<Attendance> findByStaff_IdOrderByAttendanceDateDesc(UUID staffId);
    Optional<Attendance> findByStaff_IdAndAttendanceDate(UUID staffId, LocalDate attendanceDate);
    List<Attendance> findByStaff_IdAndAttendanceDateBetweenOrderByAttendanceDateDesc(UUID staffId, LocalDate startDate, LocalDate endDate);
    List<Attendance> findByAttendanceDateBetweenOrderByAttendanceDateDesc(LocalDate startDate, LocalDate endDate);
    void deleteByStaff_Id(UUID staffId);
    void deleteByAttendanceDateAndStaff_Id(LocalDate attendanceDate, UUID staffId);
}
