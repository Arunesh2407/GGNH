package com.ggnh.hub.service.outbox;

import com.ggnh.hub.entity.AppointmentOutbox;
import com.ggnh.hub.repository.AppointmentOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Dedicated transactional helper managing isolated database transactions for outbox operations.
 *
 * Guarantees:
 * 1. Claims and lease acquisition occur in a short, dedicated transaction that commits before network calls.
 * 2. Employs fencing tokens (lease_token) so zombie workers whose lease expired cannot overwrite jobs reclaimed by another worker.
 * 3. Delivery results (SUCCESS, FAILURE, DEAD_LETTER) are committed in separate isolated transactions conditional on lease ownership.
 * 4. Stale lease recovery runs in its own isolated transaction.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppointmentOutboxTransactionHelper {

    private final AppointmentOutboxRepository outboxRepository;

    /**
     * Atomically claims an outbox job by ID in an isolated, short transaction with an explicit lease ownership token.
     * Commits the lease immediately so other workers cannot claim the same job.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<AppointmentOutbox> claimRecord(UUID id, OffsetDateTime now) {
        UUID leaseToken = UUID.randomUUID();
        int updated = outboxRepository.claimRecord(id, now, leaseToken);
        if (updated == 1) {
            return outboxRepository.findById(id);
        }
        // Lost race to another worker
        return Optional.empty();
    }

    /**
     * Records successful delivery in an isolated transaction conditional on lease ownership.
     * Returns true if the lease was still held and updated; false if lease was lost.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordSuccess(UUID id, UUID leaseToken, OffsetDateTime sentAt) {
        int updated = outboxRepository.markSentWithToken(id, sentAt, leaseToken);
        if (updated == 1) {
            log.info("Outbox event {} marked SENT (lease verified)", id);
            return true;
        }
        log.warn("Lost lease ownership for outbox event {}. A different worker reclaimed this job; ignoring stale success write.", id);
        return false;
    }

    /**
     * Records delivery failure or dead-letter state conditional on lease ownership.
     * Returns true if the lease was still held and updated; false if lease was lost.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID id, UUID leaseToken, String lastError, int attempts, OffsetDateTime nextAttemptAt, boolean deadLetter) {
        String status = deadLetter ? "DEAD_LETTER" : "FAILED";
        int updated = outboxRepository.markFailedOrDeadLetterWithToken(id, status, attempts, nextAttemptAt, lastError, leaseToken);
        if (updated == 1) {
            if (deadLetter) {
                log.warn("Outbox event {} marked DEAD_LETTER: {}", id, lastError);
            } else {
                log.info("Outbox event {} marked FAILED (attempt {}): {}", id, attempts, lastError);
            }
            return true;
        }
        log.warn("Lost lease ownership for outbox event {}. A different worker reclaimed this job; ignoring stale failure write.", id);
        return false;
    }

    /**
     * Recovers expired PROCESSING leases from crashed/hung workers in an isolated transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int recoverStaleLeases(OffsetDateTime staleBefore, OffsetDateTime now) {
        List<AppointmentOutbox> staleRecords = outboxRepository.findStaleProcessingRecords(staleBefore);
        int recoveredCount = 0;

        for (AppointmentOutbox stale : staleRecords) {
            int nextAttempts = stale.getAttempts() + 1;
            boolean deadLetter = nextAttempts >= stale.getMaxAttempts();
            String errorMsg = deadLetter
                    ? "Abandoned lease expired. Max retry attempts exceeded."
                    : "Recovered from abandoned lease timeout.";

            long backoffSeconds = calculateBackoff(nextAttempts);
            OffsetDateTime nextAttemptAt = deadLetter ? now : now.plusSeconds(backoffSeconds);

            int updated = outboxRepository.recoverStaleLeaseRecord(
                    stale.getId(),
                    deadLetter ? "DEAD_LETTER" : "FAILED",
                    nextAttempts,
                    nextAttemptAt,
                    errorMsg,
                    staleBefore
            );

            if (updated == 1) {
                recoveredCount++;
                log.warn("Recovered stale lease for outbox event {} -> {} (attempt {}/{})",
                        stale.getId(), deadLetter ? "DEAD_LETTER" : "FAILED", nextAttempts, stale.getMaxAttempts());
            }
        }

        return recoveredCount;
    }

    public long calculateBackoff(int attempt) {
        if (attempt <= 1) {
            return 5L;
        }
        long backoff = 5L * (1L << Math.min(attempt - 1, 6));
        return Math.min(backoff, 300L);
    }
}
