package com.ggnh.hub.repository;

import com.ggnh.hub.entity.Appointment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, String> {
    Page<Appointment> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Appointment> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
