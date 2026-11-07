package com.ggnh.hub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Tag("postgres")
@ActiveProfiles("postgres")
@org.junit.jupiter.api.condition.EnabledIf("isPostgresVerificationEnabled")
@TestPropertySource(properties = {
    "spring.datasource.url=${POSTGRES_TEST_URL:jdbc:postgresql://localhost:5434/ggnh_verify_db}",
    "spring.datasource.username=${POSTGRES_TEST_USER:postgres}",
    "spring.datasource.password=${POSTGRES_TEST_PASSWORD:postgres}",
    "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.flyway.enabled=true"
})
class PostgresFlywayIntegrationTest {

    static boolean isPostgresVerificationEnabled() {
        return "true".equalsIgnoreCase(System.getProperty("VERIFY_POSTGRES"))
                || "true".equalsIgnoreCase(System.getenv("VERIFY_POSTGRES"));
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Should execute Flyway migrations against actual PostgreSQL and seed roles")
    void shouldExecuteFlywayMigrationsOnPostgres() {
        // Verify flyway_schema_history has V1, V2, V3, V4, and V5 applied
        List<Map<String, Object>> flywayHistory = jdbcTemplate.queryForList(
                "SELECT version, description, type, script, success FROM flyway_schema_history ORDER BY installed_rank"
        );
        assertThat(flywayHistory).hasSize(5);
        assertThat(flywayHistory.get(0).get("version")).isEqualTo("1");
        assertThat(flywayHistory.get(0).get("success")).isEqualTo(true);
        assertThat(flywayHistory.get(1).get("version")).isEqualTo("2");
        assertThat(flywayHistory.get(1).get("success")).isEqualTo(true);
        assertThat(flywayHistory.get(2).get("version")).isEqualTo("3");
        assertThat(flywayHistory.get(2).get("success")).isEqualTo(true);
        assertThat(flywayHistory.get(3).get("version")).isEqualTo("4");
        assertThat(flywayHistory.get(3).get("success")).isEqualTo(true);
        assertThat(flywayHistory.get(4).get("version")).isEqualTo("5");
        assertThat(flywayHistory.get(4).get("success")).isEqualTo(true);

        // Verify seeded roles exist
        List<String> roleNames = jdbcTemplate.queryForList("SELECT name FROM roles ORDER BY name", String.class);
        assertThat(roleNames).containsExactly(
                "auditor",
                "department-head",
                "editor",
                "owner",
                "store-manager",
                "viewer"
        );

        // Verify V3 Firebase UID migration: column exists and is nullable, password_hash is nullable
        List<Map<String, Object>> userColumns = jdbcTemplate.queryForList(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('firebase_uid', 'password_hash') ORDER BY column_name"
        );
        assertThat(userColumns).hasSize(2);
        assertThat(userColumns.get(0).get("column_name")).isEqualTo("firebase_uid");
        assertThat(userColumns.get(0).get("is_nullable")).isEqualTo("YES");
        assertThat(userColumns.get(1).get("column_name")).isEqualTo("password_hash");
        assertThat(userColumns.get(1).get("is_nullable")).isEqualTo("YES");

        // Verify unique constraint or index on firebase_uid
        List<String> indexes = jdbcTemplate.queryForList(
                "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'users' AND indexname LIKE '%firebase_uid%'",
                String.class
        );
        assertThat(indexes).isNotEmpty();

        // Verify tables exist in public schema
        List<String> tableNames = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
                String.class
        );
        assertThat(tableNames).contains(
                "appointment_idempotency",
                "appointment_migration_mapping",
                "appointment_outbox",
                "appointments",
                "attendance",
                "flyway_schema_history",
                "inventory_categories",
                "inventory_items",
                "inventory_ledger",
                "roles",
                "staff",
                "stock_receipt_items",
                "stock_receipts",
                "suppliers",
                "user_permissions",
                "user_roles",
                "users"
        );

        // Verify V4 appointments schema refinements: patient_email and doctor_name are nullable, updated_at exists
        List<Map<String, Object>> appointmentColumns = jdbcTemplate.queryForList(
                "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name IN ('patient_email', 'doctor_name', 'updated_at') ORDER BY column_name"
        );
        assertThat(appointmentColumns).hasSize(3);
        assertThat(appointmentColumns.get(0).get("column_name")).isEqualTo("doctor_name");
        assertThat(appointmentColumns.get(0).get("is_nullable")).isEqualTo("YES");
        assertThat(appointmentColumns.get(1).get("column_name")).isEqualTo("patient_email");
        assertThat(appointmentColumns.get(1).get("is_nullable")).isEqualTo("YES");
        assertThat(appointmentColumns.get(2).get("column_name")).isEqualTo("updated_at");
        assertThat(appointmentColumns.get(2).get("is_nullable")).isEqualTo("NO");

        // Verify V4 appointment_idempotency has request_hash column
        List<Map<String, Object>> idempotencyColumns = jdbcTemplate.queryForList(
                "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointment_idempotency' AND column_name = 'request_hash'"
        );
        assertThat(idempotencyColumns).hasSize(1);
        assertThat(idempotencyColumns.get(0).get("is_nullable")).isEqualTo("NO");

        // Verify V4 appointment_outbox has lease_token column
        List<Map<String, Object>> outboxColumns = jdbcTemplate.queryForList(
                "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointment_outbox' AND column_name = 'lease_token'"
        );
        assertThat(outboxColumns).hasSize(1);
        assertThat(outboxColumns.get(0).get("is_nullable")).isEqualTo("YES");

        // Verify V5 appointment_migration_mapping enhancements: status, source_updated_at, error_message, pg_appointment_id nullable
        List<Map<String, Object>> migrationColumns = jdbcTemplate.queryForList(
                "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'appointment_migration_mapping' AND column_name IN ('status', 'source_updated_at', 'error_message', 'pg_appointment_id') ORDER BY column_name"
        );
        assertThat(migrationColumns).hasSize(4);
        assertThat(migrationColumns.get(0).get("column_name")).isEqualTo("error_message");
        assertThat(migrationColumns.get(0).get("is_nullable")).isEqualTo("YES");
        assertThat(migrationColumns.get(1).get("column_name")).isEqualTo("pg_appointment_id");
        assertThat(migrationColumns.get(1).get("is_nullable")).isEqualTo("YES");
        assertThat(migrationColumns.get(2).get("column_name")).isEqualTo("source_updated_at");
        assertThat(migrationColumns.get(2).get("is_nullable")).isEqualTo("YES");
        assertThat(migrationColumns.get(3).get("column_name")).isEqualTo("status");
        assertThat(migrationColumns.get(3).get("is_nullable")).isEqualTo("NO");

        // Verify foreign key delete rules are RESTRICT / NO ACTION (non-cascading)
        List<Map<String, Object>> foreignKeys = jdbcTemplate.queryForList(
                "SELECT tc.table_name, rc.delete_rule " +
                "FROM information_schema.table_constraints AS tc " +
                "JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name " +
                "WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY' " +
                "AND tc.table_name IN ('appointment_outbox', 'appointment_idempotency', 'appointment_migration_mapping') " +
                "ORDER BY tc.table_name"
        );
        assertThat(foreignKeys).hasSize(3);
        for (Map<String, Object> fk : foreignKeys) {
            assertThat(fk.get("delete_rule").toString()).isIn("RESTRICT", "NO ACTION");
        }
    }

    @Test
    @DisplayName("Should enforce ON DELETE RESTRICT and unique constraints on PostgreSQL")
    void shouldEnforceReferentialIntegrityAndUniqueConstraintsOnPostgres() {
        java.util.UUID appointmentId = java.util.UUID.randomUUID();
        java.util.UUID idempotencyKey = java.util.UUID.randomUUID();

        // 1. Insert appointment into PostgreSQL
        jdbcTemplate.update(
                "INSERT INTO appointments (id, patient_name, patient_phone, status, created_at, updated_at) " +
                "VALUES (?, 'Postgres Test Patient', '+91 99999 00000', 'booked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                appointmentId
        );

        // 2. Insert outbox record referencing appointment
        jdbcTemplate.update(
                "INSERT INTO appointment_outbox (appointment_id, event_type, channel, payload, status, attempts, max_attempts) " +
                "VALUES (?, 'APPOINTMENT_REQUESTED', 'EMAIL', '{\"test\": true}', 'PENDING', 0, 5)",
                appointmentId
        );

        // 3. Insert idempotency record referencing appointment
        jdbcTemplate.update(
                "INSERT INTO appointment_idempotency (idempotency_key, appointment_id, request_hash, status, created_at, expires_at) " +
                "VALUES (?, ?, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day')",
                idempotencyKey, appointmentId
        );

        // 4. Attempting to delete appointment must be blocked by ON DELETE RESTRICT
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                jdbcTemplate.update("DELETE FROM appointments WHERE id = ?", appointmentId)
        ).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        // 5. Attempting to insert duplicate idempotency key must violate unique constraint (23505)
        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                jdbcTemplate.update(
                        "INSERT INTO appointment_idempotency (idempotency_key, appointment_id, request_hash, status, created_at, expires_at) " +
                        "VALUES (?, ?, 'different-hash-0123456789abcdef0123456789abcdef0123456789abcdef', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day')",
                        idempotencyKey, appointmentId
                )
        ).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        // Clean up in reverse dependency order
        jdbcTemplate.update("DELETE FROM appointment_outbox WHERE appointment_id = ?", appointmentId);
        jdbcTemplate.update("DELETE FROM appointment_idempotency WHERE idempotency_key = ?", idempotencyKey);
        jdbcTemplate.update("DELETE FROM appointments WHERE id = ?", appointmentId);
    }
}
