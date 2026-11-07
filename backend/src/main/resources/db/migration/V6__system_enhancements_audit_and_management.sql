-- ============================================================================
-- Migration: V6__system_enhancements_audit_and_management.sql
-- Description:
-- 1. Create audit_logs table for administrative and operational traceability
-- 2. Enhance staff table with designation, department, employment status, joining date, and user reference
-- 3. Enhance attendance table with check-in/out timestamps, notes, and audit correction fields
-- 4. Enhance appointments with date/slot fields and expanded lifecycle statuses (pending, confirmed)
-- 5. Add description field to inventory_items
-- 6. Seed patient role
-- ============================================================================

-- 1. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acting_user VARCHAR(255) NOT NULL,
    action VARCHAR(60) NOT NULL,
    module VARCHAR(50) NOT NULL,
    record_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acting_user ON audit_logs(acting_user);

-- 2. Staff Profile Enhancements
ALTER TABLE staff ADD COLUMN IF NOT EXISTS designation VARCHAR(150);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS department VARCHAR(150);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'FULL_TIME';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);

-- 3. Attendance Check-in / Check-out & Correction Enhancements
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS corrected_by VARCHAR(255);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP WITH TIME ZONE;

-- 4. Appointments Lifecycle & Scheduling Fields
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS chk_appointment_status;
ALTER TABLE appointments ADD CONSTRAINT chk_appointment_status CHECK (
    status IN ('pending', 'booked', 'confirmed', 'completed', 'cancelled')
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time_slot VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

-- 5. Inventory Items Description
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS description TEXT;

-- 6. Patient Role Seeding
INSERT INTO roles (name, description) VALUES
    ('patient', 'Patient user with self-service appointment booking and viewing permissions')
ON CONFLICT (name) DO NOTHING;

