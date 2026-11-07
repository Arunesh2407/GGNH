-- ============================================================================
-- Migration: V5__appointment_migration_audit_and_tracking.sql
-- Description:
-- 1. Enhance appointment_migration_mapping for robust tracking and auditability
-- 2. Add status column (SUCCESS, FAILED, SKIPPED)
-- 3. Add source_updated_at column to track updates from Appwrite source
-- 4. Add error_message column to record unmappable records without dropping them
-- 5. Relax NOT NULL on pg_appointment_id to allow tracking failed migrations
-- ============================================================================

ALTER TABLE appointment_migration_mapping ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE appointment_migration_mapping ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointment_migration_mapping ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE appointment_migration_mapping ALTER COLUMN pg_appointment_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_migration_status ON appointment_migration_mapping(status);

