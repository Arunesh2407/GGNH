-- ============================================================================
-- Migration: V4__appointment_management_enhancements.sql
-- Description:
-- 1. Relax NOT NULL on patient_email and doctor_name to align with clinic reality
-- 2. Add updated_at audit timestamp to appointments table
-- 3. Create appointment_idempotency table for public booking deduplication
-- 4. Create appointment_outbox table for durable transactional notification dispatch
-- 5. Create appointment_migration_mapping table to preserve legacy Appwrite IDs
-- ============================================================================

-- 1. Patient email and doctor name nullability relaxation
ALTER TABLE appointments ALTER COLUMN patient_email DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN doctor_name DROP NOT NULL;

-- 2. Add updated_at if not present
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Idempotency table with client-generated UUID primary key and deterministic request fingerprint
CREATE TABLE appointment_idempotency (
    idempotency_key UUID PRIMARY KEY,
    appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_appointment_idempotency_expires ON appointment_idempotency(expires_at);

-- 4. Transactional Outbox for durable notification dispatch (ON DELETE RESTRICT preserves pending events)
CREATE TABLE appointment_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_appointment_outbox_status_next ON appointment_outbox(status, next_attempt_at);

-- 5. Migration Mapping table to preserve legacy Appwrite IDs without polluting domain entity
CREATE TABLE appointment_migration_mapping (
    legacy_appwrite_id VARCHAR(50) PRIMARY KEY,
    pg_appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    raw_document TEXT NOT NULL,
    migrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_appointment_migration_pg_id ON appointment_migration_mapping(pg_appointment_id);
