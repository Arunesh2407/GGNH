package com.ggnh.hub.repository;

import com.ggnh.hub.entity.AppointmentOutbox;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentOutboxRepository extends JpaRepository<AppointmentOutbox, UUID> {

    @Query("SELECT o FROM AppointmentOutbox o WHERE o.status IN ('PENDING', 'FAILED') AND o.nextAttemptAt <= :now ORDER BY o.createdAt ASC")
    List<AppointmentOutbox> findReadyToProcess(@Param("now") OffsetDateTime now, Pageable pageable);

    @Query("SELECT o FROM AppointmentOutbox o WHERE o.status = 'PROCESSING' AND o.lockedAt <= :staleBefore")
    List<AppointmentOutbox> findStaleProcessingRecords(@Param("staleBefore") OffsetDateTime staleBefore);

    @Modifying
    @Query("UPDATE AppointmentOutbox o SET o.status = 'PROCESSING', o.lockedAt = :now, o.leaseToken = :leaseToken " +
           "WHERE o.id = :id AND o.status IN ('PENDING', 'FAILED') AND o.nextAttemptAt <= :now")
    int claimRecord(@Param("id") UUID id, @Param("now") OffsetDateTime now, @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query("UPDATE AppointmentOutbox o SET o.status = 'SENT', o.sentAt = :sentAt, o.lockedAt = null, o.leaseToken = null, o.lastError = null " +
           "WHERE o.id = :id AND o.status = 'PROCESSING' AND o.leaseToken = :leaseToken")
    int markSentWithToken(@Param("id") UUID id, @Param("sentAt") OffsetDateTime sentAt, @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query("UPDATE AppointmentOutbox o SET o.status = :status, o.attempts = :attempts, o.nextAttemptAt = :nextAttemptAt, o.lockedAt = null, o.leaseToken = null, o.lastError = :lastError " +
           "WHERE o.id = :id AND o.status = 'PROCESSING' AND o.leaseToken = :leaseToken")
    int markFailedOrDeadLetterWithToken(@Param("id") UUID id,
                                       @Param("status") String status,
                                       @Param("attempts") int attempts,
                                       @Param("nextAttemptAt") OffsetDateTime nextAttemptAt,
                                       @Param("lastError") String lastError,
                                       @Param("leaseToken") UUID leaseToken);

    @Modifying
    @Query("UPDATE AppointmentOutbox o SET o.status = :status, o.attempts = :attempts, o.nextAttemptAt = :nextAttemptAt, o.lockedAt = null, o.leaseToken = null, o.lastError = :lastError " +
           "WHERE o.id = :id AND o.status = 'PROCESSING' AND o.lockedAt <= :staleBefore")
    int recoverStaleLeaseRecord(@Param("id") UUID id,
                               @Param("status") String status,
                               @Param("attempts") int attempts,
                               @Param("nextAttemptAt") OffsetDateTime nextAttemptAt,
                               @Param("lastError") String lastError,
                               @Param("staleBefore") OffsetDateTime staleBefore);

    List<AppointmentOutbox> findByAppointmentId(UUID appointmentId);
}

