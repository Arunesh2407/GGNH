package com.ggnh.hub.repository;

import com.ggnh.hub.entity.AppointmentIdempotency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
public interface AppointmentIdempotencyRepository extends JpaRepository<AppointmentIdempotency, UUID> {

    @Modifying
    @Query("DELETE FROM AppointmentIdempotency i WHERE i.expiresAt < :now")
    int deleteExpired(@Param("now") OffsetDateTime now);
}

