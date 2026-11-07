package com.ggnh.hub.repository;

import com.ggnh.hub.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StaffRepository extends JpaRepository<Staff, UUID> {
    List<Staff> findByIsActiveTrue();
    Optional<Staff> findByEmail(String email);
    Optional<Staff> findByEmailIgnoreCase(String email);
    Optional<Staff> findByUser_Id(UUID userId);

    @Query("SELECT s FROM Staff s WHERE " +
           "(:role IS NULL OR LOWER(s.role) = LOWER(:role)) AND " +
           "(:department IS NULL OR LOWER(s.department) = LOWER(:department)) AND " +
           "(:isActive IS NULL OR s.isActive = :isActive) AND " +
           "(:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(s.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           " LOWER(s.phone) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY s.name ASC")
    List<Staff> searchStaff(
            @Param("search") String search,
            @Param("role") String role,
            @Param("department") String department,
            @Param("isActive") Boolean isActive
    );
}
