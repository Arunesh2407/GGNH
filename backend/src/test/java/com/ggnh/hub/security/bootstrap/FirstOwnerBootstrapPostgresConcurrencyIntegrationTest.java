package com.ggnh.hub.security.bootstrap;

import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.net.Socket;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Concurrency integration test executing against a dedicated disposable PostgreSQL instance.
 * Exercises the real pg_try_advisory_xact_lock query on independent JDBC connections.
 * 
 * Target: jdbc:postgresql://localhost:5434/ggnh_verify_db
 * NEVER connects to live Supabase database.
 */
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
    "spring.flyway.enabled=true",
    "app.bootstrap.first-owner.enabled=true"
})
class FirstOwnerBootstrapPostgresConcurrencyIntegrationTest {

    static boolean isPostgresVerificationEnabled() {
        if ("true".equalsIgnoreCase(System.getProperty("VERIFY_POSTGRES"))
                || "true".equalsIgnoreCase(System.getenv("VERIFY_POSTGRES"))) {
            return true;
        }
        try (Socket s = new Socket("127.0.0.1", 5434)) {
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private FirstOwnerBootstrapService bootstrapService;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        // Clean any existing test user in the disposable test database
        jdbcTemplate.execute("DELETE FROM user_permissions WHERE user_id IN (SELECT id FROM users WHERE email = 'ggnhpvtltd@gmail.com')");
        jdbcTemplate.execute("DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = 'ggnhpvtltd@gmail.com')");
        jdbcTemplate.execute("DELETE FROM users WHERE email = 'ggnhpvtltd@gmail.com'");
    }

    @Test
    @DisplayName("Verify actual PostgreSQL advisory transaction lock is exercised on PostgreSQL engine")
    void verifyPostgresAdvisoryLockExecutionOnRealPostgres() {
        // Assert we are connected to PostgreSQL and not H2
        String dbProduct = jdbcTemplate.queryForObject("SELECT version()", String.class);
        assertThat(dbProduct).containsIgnoringCase("PostgreSQL");

        // Verify native advisory transaction lock query executes cleanly on this connection
        Boolean lockAcquired = jdbcTemplate.queryForObject(
                "SELECT pg_try_advisory_xact_lock(?)",
                Boolean.class,
                FirstOwnerBootstrapService.BOOTSTRAP_ADVISORY_LOCK_ID
        );
        assertThat(lockAcquired).isTrue();
    }

    @Test
    @DisplayName("PostgreSQL Concurrency: Multi-threaded race with independent connections produces exactly one owner")
    void testPostgresConcurrentBootstrap_WithRealAdvisoryLock() throws Exception {
        int threadCount = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger refusedOrAlreadyProvisionedCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    // Each thread executes on its own independent JDBC connection and transaction
                    BootstrapResult result = bootstrapService.executeBootstrap();
                    if (result.getStatus() == BootstrapResult.Status.CREATED) {
                        successCount.incrementAndGet();
                    } else {
                        refusedOrAlreadyProvisionedCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    // Advisory lock rejection, countActiveOwners rejection, or unique constraint violation
                    refusedOrAlreadyProvisionedCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Release all concurrent threads simultaneously
        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        // At least one thread should have succeeded in creating the owner
        assertThat(successCount.get()).isGreaterThanOrEqualTo(1);

        // Verify exactly one owner user exists in the PostgreSQL database
        assertThat(userRepository.countActiveOwners()).isEqualTo(1L);

        User owner = userRepository.findByEmailIgnoreCase(FirstOwnerBootstrapService.BOOTSTRAP_TARGET_EMAIL).orElseThrow();
        assertThat(owner.getFirebaseUid()).isNull();
        assertThat(owner.isActive()).isTrue();
        assertThat(owner.getCreatedBy()).isEqualTo("SYSTEM_BOOTSTRAP");

        assertThat(owner.getRoles()).extracting(Role::getName).containsExactly("owner");

        UserPermission permissions = owner.getPermissions();
        assertThat(permissions).isNotNull();
        assertThat(permissions.isManageAttendance()).isTrue();
        assertThat(permissions.isManageAppointments()).isTrue();
        assertThat(permissions.isManageUsers()).isTrue();
        assertThat(permissions.isManageInventory()).isTrue();
        assertThat(permissions.isManageInventoryReports()).isTrue();
    }
}

