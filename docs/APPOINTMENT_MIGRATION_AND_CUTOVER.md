# GG Nursing Home Hub — Appointment Architecture, Clean Launch & Operations Specification

> [!IMPORTANT]
> **Product Decision — Clean PostgreSQL Launch (No Historical Data Migration)**:
> In accordance with product requirements for the launch of GG Nursing Home Hub, **no historical appointment data from Appwrite is imported, copied, backfilled, synchronized, or reconciled into PostgreSQL**.
> The new appointment system launches with an entirely **clean, empty appointment history**. All legacy extraction scripts, migration endpoints, reconciliation services, and temporary export checkpoints have been decommissioned.

---

## 1. Executive Summary

This document serves as the canonical, authoritative specification for the technical architecture, database schema, operational workflows, and security policies governing the Appointment Management system of GG Nursing Home Hub.

### Architectural Core:
- **Authoritative Data Persistence**: PostgreSQL 16 managed via Flyway migrations (`V1` through `V5`).
- **Identity & Authentication**: Firebase Authentication with Bearer JWT tokens verified server-side via `FirebaseAuthenticationFilter`.
- **Client Access**: Modern React frontend interacting exclusively with Spring Boot REST endpoints (`/api/v1/appointments`).
- **Notification Reliability**: Transactional outbox worker (`appointment_outbox`) with lease tokens and exponential backoff replaces client-side webhooks.
- **Transactional Idempotency**: Atomic reservation and SHA-256 request fingerprinting (`appointment_idempotency`) guarantee zero duplicate bookings under network retries and concurrent submission races.
- **Ecosystem Boundary**: Appwrite is completely decommissioned for all appointment workflows. Appwrite remains active solely for non-appointment modules (Staff, Attendance, and Inventory).

---

## 2. Definitive API Contract Matrix

The appointment subsystem exposes the following consolidated REST endpoints under `/api/v1/appointments`:

| HTTP Method | Controller Mapping | Effective Endpoint | Frontend Caller | Authentication | Authorization Requirement | Request DTO / Payload | Response DTO | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `@PostMapping` | `/api/v1/appointments` | `Contact.tsx` via `appointmentService.addAppointment()` | **None (Public)** | `permitAll()` in `SecurityConfig` | `CreateAppointmentRequest` (`patientName`, `patientPhone`, optional `patientEmail`, `doctorName`, `message`) + `Idempotency-Key` header | `AppointmentResponse` (HTTP 201) | Books a new appointment atomically with idempotency reservation and transactional outbox event. |
| **GET** | `@GetMapping` | `/api/v1/appointments` | `StaffAppointments.tsx` via `appointmentService.getPagedAppointments()` & `getAppointments()` | **Firebase JWT** | `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")` | Query params: `page` (default 0), `size` (default 50), `status` (optional: `booked`, `completed`, `cancelled`) | `PagedAppointmentResponse` (HTTP 200) | Retrieves paginated appointment list with total elements and pages. Empty database returns `content: []`, `totalElements: 0`. |
| **GET** | `@GetMapping("/{id}")` | `/api/v1/appointments/{id}` | `appointmentService.getAppointmentById(id)` | **Firebase JWT** | `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")` | Path: `id` (UUID) | `AppointmentResponse` (HTTP 200) | Fetches single appointment details by UUID. |
| **PATCH** | `@PatchMapping("/{id}/complete")` | `/api/v1/appointments/{id}/complete` | `StaffAppointments.tsx` via `appointmentService.completeAppointment(id)` | **Firebase JWT** | `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")` | Path: `id` (UUID) | `AppointmentResponse` (HTTP 200) | Marks appointment `COMPLETED` and records `completedAt` timestamp. Idempotent on already completed records. |

> [!NOTE]
> All administrative migration endpoints (`/api/v1/admin/migration/**`) have been permanently removed.

---

## 3. Database Schema & Flyway Migrations (V1–V5)

The database schema is initialized and maintained entirely through immutable Flyway migrations (`V1` through `V5`). In a clean launch:
1. Flyway executes all five migrations sequentially on a fresh PostgreSQL database.
2. No seed or dummy appointment records are created.
3. Tables start in an empty state ready for production traffic.

### 3.1 `appointments` Table (Flyway V1, hardened in V4 & V5)
Stores the authoritative state of all patient appointments.
```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY,
    patient_name VARCHAR(200) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    patient_email VARCHAR(255),
    doctor_name VARCHAR(150),
    message TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'BOOKED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);
```

### 3.2 `appointment_idempotency` Table (Flyway V2 & V4)
Guarantees atomic, exactly-once booking semantics for public form submissions.
```sql
CREATE TABLE appointment_idempotency (
    idempotency_key UUID PRIMARY KEY,
    appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    response_payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_appointment_idempotency_expires_at ON appointment_idempotency(expires_at);
```

### 3.3 `appointment_outbox` Table (Flyway V2, V3 & V4)
Guarantees at-least-once asynchronous event dispatch for external notifications without distributed 2PC.
```sql
CREATE TABLE appointment_outbox (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    event_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP WITH TIME ZONE,
    lease_token UUID,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_appointment_outbox_poll 
ON appointment_outbox (status, next_attempt_at) 
WHERE status IN ('PENDING', 'FAILED');
```

### 3.4 Flyway Immutability Note regarding `appointment_migration_mapping`
Flyway migrations `V1` through `V5` remain immutable to preserve checksum integrity across deployments. The table `appointment_migration_mapping` (defined in V4 and indexed in V5) is created during initialization but remains an empty, inactive table because no historical migration is executed.

---

## 4. Architectural Boundaries: What Was Removed vs. Retained

To satisfy the clean-launch requirement and eliminate migration complexity, the codebase was audited and divided cleanly:

### 4.1 Decommissioned & Removed Components
The following migration-only components were permanently removed from the application:

| Component | File Path | Removal Rationale |
| :--- | :--- | :--- |
| **Appwrite Extraction CLI** | `scripts/migrate-appwrite-appointments.ts` | Eliminates historical extraction tooling, cursor checkpoint logic, and CLI token handling. |
| **Migration Extraction Test** | `src/test/migrationExtraction.test.ts` | Test suite for obsolete extraction CLI. |
| **Migration REST Controller** | `backend/.../controller/AppointmentMigrationController.java` | Removed `/api/v1/admin/migration/**` endpoints (`/appointments`, `/reconcile`, `/purge-expired`). |
| **Migration Service & DTOs** | `backend/.../service/migration/*` (`AppointmentMigrationService`, `AppwriteDocumentDto`, `MigrationResult`, `ReconciliationReport`, `UUIDv5Helper`) | Removed all Appwrite document deserialization, RFC 4122 UUIDv5 mapping, and reconciliation logic. |
| **Migration Mapping Entity & Repo** | `backend/.../entity/AppointmentMigrationMapping.java`, `backend/.../repository/AppointmentMigrationMappingRepository.java` | Removed JPA mappings for historical Appwrite tracking. |
| **Migration Test Suites** | `backend/.../AppointmentMigrationControllerSecurityTest.java`, `backend/.../AppointmentMigrationIntegrationTest.java` | Removed backend migration test suites. |
| **Server-Side Appwrite Migration Env** | `.env.example` (`APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`, `APPWRITE_APPOINTMENT_COLLECTION_ID`) | Server-side Appwrite environment variables removed; Spring Boot backend requires zero Appwrite credentials. |

### 4.2 Retained Components & Active Boundaries
The following components are retained and actively maintained:

| Subsystem | Components | Operational Status & Scope |
| :--- | :--- | :--- |
| **Appointment Core Persistence** | `AppointmentController`, `AppointmentService`, `AppointmentBookingTxService`, `AppointmentRepository` | Authoritative persistence for all appointment bookings, listings, and completions in PostgreSQL. |
| **Transactional Idempotency** | `AppointmentIdempotency`, `AppointmentIdempotencyRepository`, `HashUtils` | Prevents duplicate bookings; returns cached 201 on identical replay; returns 409 Conflict on payload mismatch. |
| **Transactional Outbox Worker** | `AppointmentOutbox`, `AppointmentOutboxRepository`, `AppointmentOutboxWorker`, `AppointmentOutboxTransactionHelper` | Asynchronously processes email/SMS notifications with atomic lease tokens and exponential backoff. |
| **Frontend Public Workflow** | `Contact.tsx`, `appointmentService.addAppointment()` | Submits directly to `POST /api/v1/appointments` with UUIDv4 idempotency keys. Zero Appwrite interaction. |
| **Frontend Staff Workflow** | `StaffAppointments.tsx`, `appointmentService.getPagedAppointments()` | Reads from and updates PostgreSQL via Spring Boot REST API. Handles 0 appointments gracefully with empty state. |
| **Non-Appointment Appwrite Modules** | `attendanceService.ts`, `inventoryService.ts`, `accessControlService.ts`, `AdminAttendance.tsx` | **RETAINED IN FULL**. Staff attendance logging, duty rosters, and medical inventory continue to use Appwrite without modification. |

---

## 5. Security and Access Control Matrix

| Layer | Component | Security Mechanism |
| :--- | :--- | :--- |
| **Public Ingestion** | `POST /api/v1/appointments` | Anonymous access permitted (`permitAll()`). Protected against replay floods and race conditions by `Idempotency-Key` and SHA-256 payload hashing. |
| **Staff Read/Write** | `GET /api/v1/appointments`, `GET /api/v1/appointments/{id}`, `PATCH /api/v1/appointments/{id}/complete` | Protected by `FirebaseAuthenticationFilter`. Requires valid Bearer JWT. Enforces `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_APPOINTMENTS')")`. Unauthenticated requests return `401 Unauthorized`; unauthorized roles return `403 Forbidden`. |
| **Credential Isolation** | Frontend Bundle | Client bundle contains only public Firebase configurations and Appwrite client project IDs for non-appointment modules. No backend database credentials, Appwrite API keys, or service account keys are exposed. |
| **Row-Level Concurrency** | Backend Transactions | Pessimistic locking and single-transaction commit semantics ensure that appointments, idempotency reservations, and outbox records are either committed together or rolled back completely. |

---

## 6. Clean-Launch Verification Scenarios

The clean launch behavior is verified by automated integration test suites (`CleanAppointmentLaunchIntegrationTest.java` and `AppointmentManagementIntegrationTest.java`):

1. **Clean Database Initialization**:
   - Initial query to `GET /api/v1/appointments` on a freshly migrated database returns HTTP 200 with `content: []`, `totalElements: 0`, `totalPages: 0`.
   - `appointments`, `appointment_idempotency`, and `appointment_outbox` tables start with 0 rows.
2. **First Public Booking**:
   - Submitting `POST /api/v1/appointments` with an `Idempotency-Key` header creates the appointment with status `booked`.
   - Generates a completed `appointment_idempotency` record with matching SHA-256 payload hash.
   - Atomically enqueues a `PENDING` event in `appointment_outbox`.
3. **Idempotency Replay**:
   - Submitting an identical request with the same `Idempotency-Key` returns HTTP 201 with the exact same appointment payload without creating duplicate database rows.
4. **Idempotency Conflict**:
   - Submitting a different payload with an already-used `Idempotency-Key` returns HTTP 409 Conflict.
5. **Staff Dashboard Listing**:
   - Authenticated staff account retrieves the newly booked appointment via `GET /api/v1/appointments`.
   - Unauthenticated requests receive HTTP 401; non-staff roles receive HTTP 403.
6. **Appointment Completion**:
   - Authenticated staff member marks appointment complete via `PATCH /api/v1/appointments/{id}/complete`.
   - Status updates to `completed` and `completedAt` timestamp is populated.
7. **Transactional Outbox Processing**:
   - `AppointmentOutboxWorker` claims pending outbox events using atomic lease ownership and marks them `SENT`.

---

## 7. Operational & Deployment Guide

### 7.1 Pre-Launch Deployment Checklist
1. **PostgreSQL Database Provisioning**:
   - Ensure a dedicated PostgreSQL 15+ instance is running.
   - Configure Spring Boot environment variables:
     - `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:<port>/<dbname>`
     - `SPRING_DATASOURCE_USERNAME=<dbuser>`
     - `SPRING_DATASOURCE_PASSWORD=<dbpassword>`
2. **Flyway Migration Execution**:
   - Spring Boot runs Flyway migrations `V1` through `V5` automatically upon startup.
   - Verify that tables `appointments`, `appointment_idempotency`, and `appointment_outbox` are created successfully.
3. **Firebase Authentication Configuration**:
   - Verify `FIREBASE_PROJECT_ID` or Firebase Admin credentials in the backend environment.
   - Ensure staff accounts have the appropriate custom claims or role mapping for `PERM_MANAGE_APPOINTMENTS` or `owner`.
4. **Frontend Configuration**:
   - Verify `VITE_API_BASE_URL` points to the Spring Boot API (e.g. `https://api.domain.com` or `/api/v1` via reverse proxy).
   - Verify that no appointment environment variables reference Appwrite.
5. **Appwrite Operational Status**:
   - Appwrite remains online and active for Staff Attendance and Medical Inventory.
   - No maintenance mode or write freeze is needed for Appwrite appointments since historical records are not imported.
