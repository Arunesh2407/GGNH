# Appointment Backend Implementation — Canonical Architecture & Verification Report

## 1. Executive Summary

This document serves as the authoritative, canonical specification and verification report for the appointment management backend for GG Nursing Home Hub. The backend is implemented using Spring Boot 3.2.5, Java 17, PostgreSQL (version 16.15), and Firebase Authentication.

### Architectural Boundaries & Scope
- **Frontend Source Code**: Preserved without modification (frontend integration begins in Task 5.2).
- **Legacy Services**: Appwrite collections and documents remain intact and unaltered.
- **External Dependencies**: Hosted Supabase is not connected to or modified.
- **Infrastructure**: Self-contained architecture using PostgreSQL transactional mechanisms; no external message brokers (Kafka/RabbitMQ) or external distributed caches (Redis) are introduced.

---

## 2. Database Schema & Migration Verification (Flyway V1–V4)

Database migrations are managed sequentially by Flyway. The appointment enhancements are defined in [`backend/src/main/resources/db/migration/V4__appointment_management_enhancements.sql`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/main/resources/db/migration/V4__appointment_management_enhancements.sql).

### 2.1 Table: `appointments` (Domain Entity)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `patient_name VARCHAR(255) NOT NULL`
- `patient_phone VARCHAR(50) NOT NULL`
- `patient_email VARCHAR(255)` (Nullable: relaxed in V4 to accommodate walk-in and rural patients)
- `doctor_name VARCHAR(255)` (Nullable: relaxed in V4 for general nursing consultations)
- `message TEXT` (Optional patient notes)
- `status VARCHAR(50) NOT NULL DEFAULT 'BOOKED'` (`BOOKED`, `COMPLETED`, `CANCELLED`)
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `completed_at TIMESTAMP WITH TIME ZONE`

### 2.2 Table: `appointment_idempotency` (Deduplication Store)
- `idempotency_key UUID PRIMARY KEY`: Client-generated UUID provided via `Idempotency-Key` HTTP header.
- `appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT`: Strict non-destructive foreign key constraint blocking cascading deletes.
- `request_hash VARCHAR(64) NOT NULL`: Deterministic SHA-256 hexadecimal digest of canonicalized request payload.
- `status VARCHAR(20) NOT NULL`: Status of the booking operation (`COMPLETED`).
- `response_payload TEXT`: Cached JSON response payload returned to identical replayed requests.
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `expires_at TIMESTAMP WITH TIME ZONE NOT NULL`: 24-hour expiration timestamp.
- **Indexes**:
  - `idx_appointment_idempotency_expires` ON `appointment_idempotency(expires_at)`

### 2.3 Table: `appointment_outbox` (Transactional Outbox)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT`: Foreign key with `ON DELETE RESTRICT` preventing accidental deletion of appointments with pending or historical events.
- `event_type VARCHAR(50) NOT NULL` (e.g., `APPOINTMENT_REQUESTED`).
- `channel VARCHAR(20) NOT NULL` (e.g., `EMAIL`).
- `payload TEXT NOT NULL`: Masked and PII-minimized JSON payload for notification dispatch.
- `status VARCHAR(20) NOT NULL DEFAULT 'PENDING'` (`PENDING`, `PROCESSING`, `SENT`, `FAILED`, `DEAD_LETTER`).
- `attempts INT NOT NULL DEFAULT 0`
- `max_attempts INT NOT NULL DEFAULT 5`
- `next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `locked_at TIMESTAMP WITH TIME ZONE`: Lease timestamp indicating when a worker claimed the job.
- `lease_token UUID`: Unique cryptographic fencing token generated per claim to prevent zombie worker overwrites.
- `last_error TEXT`: Exact exception message or failure reason for diagnostics.
- `created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `sent_at TIMESTAMP WITH TIME ZONE`: Timestamp when delivery succeeded.
- **Indexes**:
  - `idx_appointment_outbox_status_next` ON `appointment_outbox(status, next_attempt_at)`

### 2.4 Table: `appointment_migration_mapping` (Historical Traceability)
- `legacy_appwrite_id VARCHAR(50) PRIMARY KEY`: Original Appwrite document ID.
- `pg_appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT`.
- `raw_document TEXT NOT NULL`: Verbatim historical record payload.
- `migrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- **Indexes**:
  - `idx_appointment_migration_pg_id` ON `appointment_migration_mapping(pg_appointment_id)`

---

## 3. Idempotency & Booking Transaction Architecture

### 3.1 Two-Tier Booking Transaction Architecture

The booking process is split between an outer non-transactional coordinator and an inner atomic transaction service to guarantee atomic all-or-nothing commits while preventing Hibernate `Transaction marked as rollbackOnly` errors during concurrent races:

```
[HTTP POST /api/v1/appointments] (Header: Idempotency-Key: <UUID>)
                 │
                 ▼
[AppointmentService.createAppointment] (Outer Coordinator - Non-transactional)
  1. Validate UUID header and compute deterministic SHA-256 fingerprint.
  2. Check existing record in appointment_idempotency:
     ├── Found & Hash Matches ──> Return cached 201 Created response.
     └── Found & Hash Differs ──> Throw 409 Conflict immediately.
  3. Attempt booking via AppointmentBookingTxService:
                 │
                 ▼
[AppointmentBookingTxService.executeBooking] (@Transactional REQUIRES_NEW)
  ├── 1. Insert into 'appointments' (status = BOOKED).
  ├── 2. Insert into 'appointment_outbox' (status = PENDING).
  └── 3. Insert into 'appointment_idempotency' (status = COMPLETED, flush constraint).
                 │
                 ├── [Success] ──> Commit Tx, return 201 Created.
                 └── [Conflict / Exception] ──> Full Tx Rollback (Leaves NO partial records).
                 │
  4. Outer coordinator catches DataIntegrityViolationException:
     └── Queries idempotencyRepository on a fresh session:
         ├── Winner committed with same hash ──> Return winner's 201 Created response.
         └── Winner committed with different hash ──> Throw 409 Conflict.
```

### 3.2 Key Invariants of Idempotency Implementation
1. **Atomic All-or-Nothing Commit**: Appointment persistence, outbox event generation, and completed idempotency storage occur within the same database transaction.
2. **Zero Stuck Reservations**: Because reservations are written as `COMPLETED` at commit time, an aborted or failed transaction rolls back completely. No orphaned `PROCESSING` rows or abandoned reservations can ever remain.
3. **Rollback-Only Isolation**: Running the inner transaction in `REQUIRES_NEW` ensures that when a concurrent race triggers a unique constraint violation on `idempotency_key`, only the inner transaction rolls back. The outer coordinator handles the exception on a clean, active connection without encountering Spring/Hibernate rollback-only exceptions.
4. **Deterministic Canonical Fingerprinting**:
   - Request fields are collected into a `TreeMap<String, Object>` guaranteeing alphabetically sorted key ordering: `doctor`, `email`, `message`, `name`, `phone`.
   - All string values are trimmed; empty or null optional fields are normalized consistently; emails are lowercased.
   - Serialized into canonical UTF-8 JSON bytes using Jackson and hashed with SHA-256.
   - Precludes delimiter collision attacks (e.g. pipe characters `|` cannot collide across fields).
   - Patient PII is never exposed or logged with fingerprint data.

---

## 4. Transactional Outbox Worker & Lease Fencing Architecture

### 4.1 Worker Processing Flow

Implemented in [`AppointmentOutboxWorker.java`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/main/java/com/ggnh/hub/service/outbox/AppointmentOutboxWorker.java) and [`AppointmentOutboxTransactionHelper.java`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/main/java/com/ggnh/hub/service/outbox/AppointmentOutboxTransactionHelper.java):

```
       [AppointmentOutboxWorker.processBatch] (Scheduled - Non-transactional)
                         │
Step 1: Stale Lease Recovery ──> [Helper: recoverStaleLeases] (Tx 1 - REQUIRES_NEW -> COMMIT)
                         │       Recovers locked_at <= (now - 300s); increments attempt count;
                         │       clears lease_token; reschedules with backoff or DEAD_LETTER.
                         │
Step 2: Candidate Polling ──────> [outboxRepository.findReadyToProcess]
                         │       Finds status IN ('PENDING', 'FAILED') AND next_attempt_at <= now.
                         │
Step 3: Atomic Job Claim ───────> [Helper: claimRecord] (Tx 2 - REQUIRES_NEW -> COMMIT)
                         │       Generates unique UUID leaseToken;
                         │       UPDATE WHERE id = :id AND status IN ('PENDING','FAILED')
                         │         AND next_attempt_at <= :now;
                         │       Sets status = 'PROCESSING', locked_at = now, lease_token = token.
                         │       (Commits immediately; locks are released before network I/O).
                         │
Step 4: Dispatch Notification ──> [NotificationSender.send] (Executed OUTSIDE any DB transaction)
                         │
                         ├── Success ──> [Helper: recordSuccess] (Tx 3 - REQUIRES_NEW -> COMMIT)
                         │               UPDATE WHERE id = :id AND status = 'PROCESSING'
                         │                 AND lease_token = :leaseToken;
                         │               Sets status = 'SENT', sent_at = now, lease_token = null.
                         │
                         └── Failure ──> [Helper: recordFailure] (Tx 4 - REQUIRES_NEW -> COMMIT)
                                         UPDATE WHERE id = :id AND status = 'PROCESSING'
                                           AND lease_token = :leaseToken;
                                         Sets status = 'FAILED' (or 'DEAD_LETTER'),
                                         increments attempts, calculates exponential backoff.
```

### 4.2 Concurrency & Fault Tolerance Guarantees
1. **Atomic Multi-Worker Claiming**: When multiple worker instances poll candidate jobs, PostgreSQL evaluates the atomic conditional `UPDATE` query. Exactly one worker claims each job; competitors observe 0 modified rows and skip the record.
2. **Lease Token Fencing (Zombie Worker Protection)**:
   - Each claim generates a cryptographically random `UUID leaseToken`.
   - Completion updates (`markSentWithToken`, `markFailedOrDeadLetterWithToken`) enforce `WHERE lease_token = :leaseToken`.
   - If a worker hangs during external I/O (e.g. SMTP latency exceeding the 300-second lease timeout) and its lease is reclaimed by another worker, the stale worker's completion update affects 0 rows and returns `false`. The stale worker is completely prevented from clobbering active state.
3. **Bounded Exponential Backoff & Dead-Letter**:
   - Backoff formula: $\min(300, 5 \times 2^{\text{attempts}-1})$ seconds (5s, 10s, 20s, 40s, 80s, 160s, 300s).
   - After 5 failed attempts (`max_attempts = 5`), the record transitions to `DEAD_LETTER` with `last_error` preserved for operational inspection.
4. **Documented Delivery Semantic (At-Least-Once Delivery)**:
   - If a worker crashes or network partitions immediately after an external notification provider (e.g. SMTP server) accepts a message but before the `recordSuccess` transaction commits:
   - The job remains in `PROCESSING` until the lease timeout (300 seconds) elapses, after which it is recovered and re-delivered.
   - Because third-party messaging systems do not participate in two-phase commits with PostgreSQL, **at-least-once delivery is the mathematically guaranteed semantic**. Exactly-once delivery cannot be claimed without downstream receiver deduplication.

---

## 5. Security & Access Control Specifications

1. **Role-Based Access Control**:
   - `POST /api/v1/appointments`: Publicly accessible with mandatory `Idempotency-Key: <UUID>` header. Rate-limited by IP (10 requests/minute).
   - `GET /api/v1/appointments`: Restricted to `ROLE_owner` or `PERM_MANAGE_APPOINTMENTS`. Default page size 50, maximum page size 100, sorted by `createdAt DESC, id DESC`.
   - `GET /api/v1/appointments/{id}`: Restricted to `ROLE_owner` or `PERM_MANAGE_APPOINTMENTS`.
   - `PATCH /api/v1/appointments/{id}/complete`: Restricted to `ROLE_owner` or `PERM_MANAGE_APPOINTMENTS`.
   - Unauthorized requests return HTTP `401 Unauthorized`; insufficient privileges return HTTP `403 Forbidden`.
2. **PII Protection & Audit Logging**:
   - Phone numbers are masked in logs and outbox payloads: e.g. `+91 ******3210`.
   - Email addresses are masked in logs and outbox payloads: e.g. `s***a@example.com`.
   - Patient message content is strictly excluded from all application logs.
3. **Error Handling**:
   - All errors map to clean HTTP status codes (`400`, `401`, `403`, `404`, `409`, `429`). Internal database exception traces are never exposed to clients.

---

## 6. Automated Test Verification & Evidence

### 6.1 Test Environment Configuration
- **Database Engine**: PostgreSQL 16.15 on x86_64-pc-linux-musl (Alpine Linux Docker container)
- **Port**: 5434
- **Verification Flag**: `VERIFY_POSTGRES=true`
- **Build Tool**: Apache Maven 3.x with Java 17

### 6.2 Test Commands Executed
```powershell
# 1. Compile backend test classes
cd backend; mvn test-compile
# Exit code: 0 (BUILD SUCCESS)

# 2. Run full backend test suite with PostgreSQL verification enabled
$env:VERIFY_POSTGRES="true"; mvn test
# Exit code: 0 (BUILD SUCCESS)
```

### 6.3 Test Execution Summary from Surefire Reports

| Test Suite Class | Tests Run | Failures | Errors | Skipped | Status | Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| [`AppointmentManagementIntegrationTest`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/appointment/AppointmentManagementIntegrationTest.java) | **30** | 0 | 0 | 0 | **PASSED** | 21.54s |
| [`PostgresFlywayIntegrationTest`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/PostgresFlywayIntegrationTest.java) | **2** | 0 | 0 | 0 | **PASSED** | 4.09s |
| [`AuthenticationSecurityIntegrationTest`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/security/AuthenticationSecurityIntegrationTest.java) | **12** | 0 | 0 | 0 | **PASSED** | 0.43s |
| [`SecurityRemediationRegressionTest`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/security/SecurityRemediationRegressionTest.java) | **26** | 0 | 0 | 0 | **PASSED** | 1.64s |
| [`RepositoryIntegrationTest`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/RepositoryIntegrationTest.java) | **4** | 0 | 0 | 0 | **PASSED** | 0.05s |
| [`GgnhApplicationTests`](file:///d:/TryingStuff/gg-nursing-home-hub-main/backend/src/test/java/com/ggnh/hub/GgnhApplicationTests.java) | **1** | 0 | 0 | 0 | **PASSED** | 3.62s |
| **Total** | **75** | **0** | **0** | **0** | **PASSED** | **37.75s** |

---

### 6.4 Detailed Test Coverage Breakdown for Appointment Management (30 Tests)

1. **Public Booking & Idempotency Tests**:
   - `publicBooking_WithValidPayloadAndKey_SucceedsWith201`: Valid booking creates appointment and outbox event.
   - `publicBooking_MissingIdempotencyKey_FailsWith400`: Missing header rejected with 400 Bad Request.
   - `publicBooking_InvalidUuidIdempotencyKey_FailsWith400`: Malformed UUID rejected with 400 Bad Request.
   - `publicBooking_ReusedKeyWithIdenticalPayload_ReplaysCachedResponse`: Exact payload replayed with cached 201 response.
   - `publicBooking_ReusedKeyWithDifferentPayload_Returns409Conflict`: Different payload with same key rejected with 409 Conflict.
   - `publicBooking_ConcurrentRacingRequests_OneWinnerAndReplayWithoutRollbackError`: 4 concurrent threads race with same key; 1 commits winner, 3 cleanly replay response without `rollbackOnly` failures.
2. **Deterministic Canonical Fingerprinting Tests**:
   - `fingerprintCanonicalization_WhitespaceAndEmptyVariations_ProduceStableHashes`: Leading/trailing whitespace and empty string variations produce stable identical SHA-256 digests.
   - `fingerprintCanonicalization_SpecialCharactersAndDelimiters_DoNotCollide`: Pipe characters and special JSON characters do not trigger cross-field delimiter collisions.
   - `fingerprintCanonicalization_DistinctPayloads_ProduceDifferentHashes`: Distinct doctor names, phones, or notes produce distinct SHA-256 digests.
3. **Transactional Outbox Worker & Lease Fencing Tests**:
   - `outboxWorker_ProcessesPendingAppointmentEvents`: Worker claims and dispatches pending events to `SENT`.
   - `outboxWorker_MultipleWorkersCompeting_AtomicallyClaimAndProcessWithoutDuplicates`: 4 competing worker threads process ready events without duplicate claims.
   - `outboxWorker_DeliveryFailure_IncrementsAttemptsAndSchedulesRetry`: Delivery failure records backoff delay and increments attempt count.
   - `outboxWorker_ExceedingMaxAttempts_TransitionsToDeadLetter`: Exceeding 5 attempts transitions event to `DEAD_LETTER`.
   - `outboxWorker_StaleLeaseRecovery_RecoversAbandonedJobs`: Abandoned lease older than 300s is recovered back to `FAILED`.
   - `outboxWorker_ExpiredLeaseOwnerCannotOverwriteReclaimedJob`: Stale worker whose lease expired cannot overwrite state reclaimed by another worker.
   - `outboxWorker_DuplicateDeliveryLimitation_DocumentedAndVerified`: Verifies at-least-once delivery retry behavior on crash recovery.
4. **Staff Listing, Filtering & Detail Retrieval**:
   - `staffListing_Unauthenticated_Returns401`: Anonymous request returns 401.
   - `staffListing_UnauthorizedRole_Returns403`: Viewer role without manage permission returns 403.
   - `staffListing_AuthorizedOwner_Returns200WithPagedResults`: Owner role successfully retrieves paginated list.
   - `staffListing_AuthorizedStaffWithPermission_Returns200`: Staff with `PERM_MANAGE_APPOINTMENTS` retrieves paginated list.
   - `staffListing_PaginationAndFiltering_WorksCorrectly`: Pagination bounds (default 50, max 100) and status filter (`BOOKED`, `COMPLETED`) verified.
   - `appointmentDetail_Authorized_Returns200`: Single appointment detail retrieval verified.
   - `appointmentDetail_NotFound_Returns404`: Non-existent UUID returns 404.
5. **Status Transitions & Referential Integrity**:
   - `markCompleted_FromBooked_TransitionsToCompleted`: Successfully marks `BOOKED` appointment as `COMPLETED`.
   - `markCompleted_AlreadyCompleted_IsIdempotent`: Marking already-completed appointment returns existing record.
   - `markCompleted_CancelledAppointment_Returns409Conflict`: Attempting to complete a `CANCELLED` appointment fails with 409 Conflict.
   - `referentialIntegrity_DeletingAppointmentWithOutbox_FailsWithRestrict`: PostgreSQL `ON DELETE RESTRICT` blocks deleting appointment with associated outbox events.
   - `referentialIntegrity_DeletingAppointmentWithIdempotency_FailsWithRestrict`: PostgreSQL `ON DELETE RESTRICT` blocks deleting appointment with idempotency history.
   - `publicBooking_TransactionalRollback_LeavesNoPartialRecords`: Verifies atomic all-or-nothing rollback when an error occurs during booking.

---

## 7. Migration Verification (`PostgresFlywayIntegrationTest`)

Executed against clean PostgreSQL 16.15:
1. **Migrations V1 $\rightarrow$ V4 Clean Application**: All migrations applied sequentially without error.
2. **Schema Engine Validation**:
   - `appointment_idempotency.request_hash` is verified `is_nullable = 'NO'`.
   - `appointment_outbox.lease_token` is verified present and nullable.
   - `information_schema.referential_constraints` confirms `delete_rule = 'RESTRICT'` for all outbox, idempotency, and migration mapping foreign keys referencing `appointments(id)`.
3. **Constraint Validation**: Unique constraints and foreign key restrict rules verified directly against the PostgreSQL engine.

---

## 8. Transition Boundary

The backend consistency audit and documentation cleanup are complete.
- **Backend Status**: Verified against PostgreSQL 16.15 with 75 passing tests and zero failures.
- **Readiness**: The backend contract is finalized and ready for Task 5.2 (Frontend Integration).
