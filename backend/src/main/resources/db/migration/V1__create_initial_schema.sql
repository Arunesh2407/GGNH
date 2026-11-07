-- PostgreSQL 16 Initial Schema Migration for GG Nursing Home Hub
-- Database Foundation Migration V1

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Identity & Access Management Module
-- ============================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL CONSTRAINT uq_roles_name UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL CONSTRAINT uq_users_email UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_permissions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    manage_attendance BOOLEAN NOT NULL DEFAULT FALSE,
    manage_appointments BOOLEAN NOT NULL DEFAULT FALSE,
    manage_users BOOLEAN NOT NULL DEFAULT FALSE,
    manage_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    manage_inventory_reports BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. Staff & Attendance Module
-- ============================================================================

CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    role VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staff_is_active ON staff(is_active);
CREATE INDEX idx_staff_name ON staff(name);

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attendance_staff_date UNIQUE (staff_id, attendance_date),
    CONSTRAINT chk_attendance_status CHECK (
        status IN ('present', 'absent', 'leave', 'off', 'half-time', 'over-time')
    )
);

CREATE INDEX idx_attendance_date ON attendance(attendance_date);

-- ============================================================================
-- 3. Patient Appointments Module
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name VARCHAR(200) NOT NULL,
    patient_email VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    doctor_name VARCHAR(150) NOT NULL,
    message TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'booked',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_appointment_status CHECK (
        status IN ('booked', 'completed', 'cancelled')
    )
);

CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_created_at ON appointments(created_at DESC);

-- ============================================================================
-- 4. Inventory Management Module
-- ============================================================================

CREATE TABLE inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL CONSTRAINT uq_inventory_categories_name UNIQUE,
    code VARCHAR(30) NOT NULL CONSTRAINT uq_inventory_categories_code UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL CONSTRAINT uq_suppliers_code UNIQUE,
    contact_person VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL CONSTRAINT uq_inventory_items_sku UNIQUE,
    category_id UUID NOT NULL REFERENCES inventory_categories(id) ON DELETE RESTRICT,
    default_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    unit VARCHAR(30) NOT NULL,
    reorder_level INT NOT NULL DEFAULT 0 CONSTRAINT chk_inventory_items_reorder CHECK (reorder_level >= 0),
    current_stock INT NOT NULL DEFAULT 0 CONSTRAINT chk_inventory_items_stock CHECK (current_stock >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_supplier ON inventory_items(default_supplier_id);

CREATE TABLE stock_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) NOT NULL CONSTRAINT uq_stock_receipts_number UNIQUE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    received_date DATE NOT NULL,
    notes TEXT,
    received_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_receipts_supplier ON stock_receipts(supplier_id);
CREATE INDEX idx_stock_receipts_received_date ON stock_receipts(received_date DESC);

CREATE TABLE stock_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CONSTRAINT chk_stock_receipt_items_qty CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CONSTRAINT chk_stock_receipt_items_cost CHECK (unit_cost >= 0.00),
    batch_no VARCHAR(100) NOT NULL,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_receipt_items_receipt ON stock_receipt_items(receipt_id);
CREATE INDEX idx_stock_receipt_items_item ON stock_receipt_items(item_id);
CREATE INDEX idx_stock_receipt_items_batch ON stock_receipt_items(batch_no);

CREATE TABLE inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL CONSTRAINT chk_inventory_ledger_action CHECK (
        action IN ('receive', 'issue', 'adjust', 'waste', 'return')
    ),
    quantity INT NOT NULL CONSTRAINT chk_inventory_ledger_qty CHECK (quantity <> 0),
    balance_after INT NOT NULL CONSTRAINT chk_inventory_ledger_balance CHECK (balance_after >= 0),
    source_id UUID,
    source_type VARCHAR(50) NOT NULL CONSTRAINT chk_inventory_ledger_source CHECK (
        source_type IN ('stock-receipt', 'stock-issue', 'stock-adjustment', 'manual-adjustment')
    ),
    notes TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_ledger_item_created ON inventory_ledger(item_id, created_at DESC);
CREATE INDEX idx_inventory_ledger_source ON inventory_ledger(source_type, source_id);

