package com.ggnh.hub.repository;

import com.ggnh.hub.entity.Appointment;
import com.ggnh.hub.entity.enums.AppointmentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    Page<Appointment> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Appointment> findByStatusOrderByCreatedAtDesc(AppointmentStatus status, Pageable pageable);
    Page<Appointment> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
    Page<Appointment> findByStatusOrderByCreatedAtDescIdDesc(AppointmentStatus status, Pageable pageable);

    @Query("SELECT a FROM Appointment a WHERE " +
           "(:status IS NULL OR a.status = :status) AND " +
           "(:startDate IS NULL OR a.appointmentDate >= :startDate) AND " +
           "(:endDate IS NULL OR a.appointmentDate <= :endDate) AND " +
           "(:search IS NULL OR " +
           " LOWER(a.patientName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(a.patientPhone) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(a.patientEmail) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(a.doctorName) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY a.createdAt DESC, a.id DESC")
    Page<Appointment> searchAppointments(
            @Param("search") String search,
            @Param("status") AppointmentStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable
    );

    long countByStatus(AppointmentStatus status);
    List<Appointment> findTop5ByOrderByCreatedAtDesc();
    List<Appointment> findByPatientEmailIgnoreCaseOrderByCreatedAtDesc(String patientEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Appointment a WHERE a.id = :id")
    Optional<Appointment> findByIdForUpdate(@Param("id") UUID id);
}
