-- Seed static system roles for RBAC
-- Database Foundation Migration V2

INSERT INTO roles (name, description) VALUES
    ('owner', 'Hospital owner / super administrator with full system authority'),
    ('editor', 'Staff manager with write permissions for staff and attendance'),
    ('viewer', 'Read-only access across clinical and administrative views'),
    ('store-manager', 'Inventory controller managing master data, vendors, and inward stock'),
    ('department-head', 'Departmental supervisor with view and requisition permissions'),
    ('auditor', 'Read-only audit inspector for compliance and ledger verification')
ON CONFLICT (name) DO NOTHING;

