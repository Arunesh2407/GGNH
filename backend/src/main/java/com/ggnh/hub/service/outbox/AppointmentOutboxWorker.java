package com.ggnh.hub.service.outbox;

import com.ggnh.hub.entity.AppointmentOutbox;
import com.ggnh.hub.repository.AppointmentOutboxRepository;
import com.ggnh.hub.service.notification.NotificationSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Scheduled worker that processes transactional outbox events.
 * 
 * Reliability guarantees:
 * 1. Claiming and lease acquisition occur in a short, dedicated transaction that commits BEFORE external delivery.
 * 2. Network delivery calls execute outside of database transactions (no connection held during I/O).
 * 3. Delivery status updates commit in isolated transactions.
 * 4. Stale leases from crashed workers are automatically recovered.
 * 
 * AT-LEAST-ONCE DELIVERY LIMITATION:
 * If the worker process or node crashes after an external notification is successfully accepted by the
 * recipient provider (e.g. SMTP server) but BEFORE the 'SENT' status transaction commits, the lease will
 * eventually expire and be recovered, leading to a duplicate transmission.
 * External messaging systems do not participate in 2-phase commits with PostgreSQL, so at-least-once
 * is the strongest mathematical guarantee achievable without downstream idempotent message deduplication.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppointmentOutboxWorker {

    private final AppointmentOutboxRepository outboxRepository;
    private final AppointmentOutboxTransactionHelper transactionHelper;
    private final List<NotificationSender> notificationSenders;

    @Value("${app.outbox.enabled:true}")
    private boolean outboxEnabled;

    @Value("${app.outbox.batch-size:20}")
    private int batchSize;

    @Value("${app.outbox.lease-timeout-seconds:300}")
    private int leaseTimeoutSeconds;

    @Scheduled(fixedDelayString = "${app.outbox.poll-interval-ms:5000}")
    public void scheduledProcess() {
        if (!outboxEnabled) {
            return;
        }
        processBatch();
    }

    /**
     * Executes one processing pass.
     * Note: processBatch is deliberately NOT annotated @Transactional so that individual
     * claims, network calls, and completion writes run in separate, non-overlapping transaction scopes.
     */
    public void processBatch() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime readyCutoff = now.plusSeconds(5);

        // 1. Recover abandoned processing records in a short dedicated transaction
        OffsetDateTime staleBefore = now.minusSeconds(Math.max(30, leaseTimeoutSeconds));
        transactionHelper.recoverStaleLeases(staleBefore, now);

        // 2. Poll candidates ready to process
        List<AppointmentOutbox> readyRecords = outboxRepository.findReadyToProcess(
                readyCutoff,
                PageRequest.of(0, Math.max(1, batchSize))
        );

        for (AppointmentOutbox candidate : readyRecords) {
            // 3. Atomically claim lease in a short dedicated transaction that commits immediately
            Optional<AppointmentOutbox> claimedOpt = transactionHelper.claimRecord(candidate.getId(), readyCutoff);
            if (claimedOpt.isEmpty()) {
                // Lost race to a competing worker thread/instance; proceed to next
                continue;
            }

            AppointmentOutbox record = claimedOpt.get();

            // 4. Perform external dispatch OUTSIDE any database transaction
            NotificationSender sender = notificationSenders.stream()
                    .filter(s -> s.supports(record.getChannel()))
                    .findFirst()
                    .orElse(null);

            if (sender == null) {
                String error = "No registered NotificationSender supports channel: " + record.getChannel();
                transactionHelper.recordFailure(record.getId(), record.getLeaseToken(), error, record.getAttempts() + 1, now, true);
                continue;
            }

            try {
                sender.send(record);
                // 5. Commit success in a separate isolated transaction conditional on lease token
                transactionHelper.recordSuccess(record.getId(), record.getLeaseToken(), OffsetDateTime.now());
            } catch (RuntimeException ex) {
                int attempts = record.getAttempts() + 1;
                boolean deadLetter = attempts >= record.getMaxAttempts();
                long backoffSeconds = transactionHelper.calculateBackoff(attempts);
                OffsetDateTime nextAttemptAt = deadLetter ? now : OffsetDateTime.now().plusSeconds(backoffSeconds);

                // 6. Commit failure/dead-letter in a separate isolated transaction conditional on lease token
                transactionHelper.recordFailure(record.getId(), record.getLeaseToken(), ex.getMessage(), attempts, nextAttemptAt, deadLetter);
            }
        }
    }
}
