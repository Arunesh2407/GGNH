-- Add Firebase UID identity mapping to users table
-- Database Foundation Migration V3

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) CONSTRAINT uq_users_firebase_uid UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Password hash is no longer mandatory since Firebase manages credentials
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;
