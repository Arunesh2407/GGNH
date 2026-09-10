package com.ggnh.hub.repository;

import com.ggnh.hub.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, String> {
    List<Attendance> findByDate(String date);
    List<Attendance> findByStaffId(String staffId);
    void deleteByStaffId(String staffId);
    void deleteByDateAndStaffId(String date, String staffId);
}
