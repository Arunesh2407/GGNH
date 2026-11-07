package com.ggnh.hub.security.bootstrap;

import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.service.UserSecurityService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class FirstOwnerBootstrapTest {

    private static final String TARGET_EMAIL = "ggnhpvtltd@gmail.com";
    private static final String VALID_SECRET = "a-very-secure-high-entropy-secret-key-32-chars-long";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserPermissionRepository userPermissionRepository;

    @Autowired
    private FirstOwnerBootstrapService bootstrapService;

    @Autowired
    private UserSecurityService userSecurityService;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private Role ownerRole;
    private Role viewerRole;

    @BeforeEach
    void setUp() {
        userPermissionRepository.deleteAll();
        userRepository.deleteAll();

        ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("owner")
                        .description("Hospital owner / super administrator")
                        .build()));

        viewerRole = roleRepository.findByName("viewer")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("viewer")
                        .description("Read-only viewer")
                        .build()));
    }

    @Test
    @DisplayName("1. Bootstrap succeeds: Creates owner with null firebase_uid, active=true, and full permissions")
    void testBootstrapSuccess_CreatesOwnerWithFullPermissions() {
        BootstrapResult result = bootstrapService.executeBootstrap(TARGET_EMAIL);

        assertThat(result.getStatus()).isEqualTo(BootstrapResult.Status.CREATED);
        assertThat(result.getUserId()).isNotNull();

        User user = userRepository.findByEmailIgnoreCase(TARGET_EMAIL).orElseThrow();
        assertThat(user.getFirebaseUid()).isNull();
        assertThat(user.isActive()).isTrue();
        assertThat(user.getCreatedBy()).isEqualTo("SYSTEM_BOOTSTRAP");

        assertThat(user.getRoles()).extracting(Role::getName).containsExactly("owner");

        UserPermission permissions = user.getPermissions();
        assertThat(permissions).isNotNull();
        assertThat(permissions.isManageAttendance()).isTrue();
        assertThat(permissions.isManageAppointments()).isTrue();
        assertThat(permissions.isManageUsers()).isTrue();
        assertThat(permissions.isManageInventory()).isTrue();
        assertThat(permissions.isManageInventoryReports()).isTrue();
    }

    @Test
    @DisplayName("2. Bootstrap aborts: Refuses execution when an active owner already exists")
    void testBootstrapAborts_WhenActiveOwnerAlreadyExists() {
        // Pre-create an active owner
        User existingOwner = User.builder()
                .email("existing-owner@ggnh.org")
                .firebaseUid("fb-existing-owner-uid")
                .isActive(true)
                .roles(Set.of(ownerRole))
                .build();
        userRepository.save(existingOwner);

        assertThat(userRepository.countActiveOwners()).isEqualTo(1L);

        assertThatThrownBy(() -> bootstrapService.executeBootstrap(TARGET_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("an active owner already exists");

        // Target user must not have been created
        assertThat(userRepository.findByEmailIgnoreCase(TARGET_EMAIL)).isEmpty();
    }

    @Test
    @DisplayName("3. Bootstrap aborts: Refuses execution when target email has a conflicting Firebase UID")
    void testBootstrapAborts_WhenTargetEmailHasConflictingUid() {
        User conflictingUser = User.builder()
                .email(TARGET_EMAIL)
                .firebaseUid("conflicting-uid-12345")
                .isActive(false)
                .roles(Set.of(viewerRole))
                .build();
        userRepository.save(conflictingUser);

        assertThatThrownBy(() -> bootstrapService.executeBootstrap(TARGET_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already mapped to a Firebase UID");
    }

    @Test
    @DisplayName("4. Bootstrap aborts: Refuses execution when target email exists in conflicting state (no silent promotion)")
    void testBootstrapAborts_WhenTargetEmailHasConflictingRole() {
        User conflictingUser = User.builder()
                .email(TARGET_EMAIL)
                .firebaseUid(null)
                .isActive(false) // inactive viewer
                .roles(Set.of(viewerRole))
                .build();
        userRepository.save(conflictingUser);

        assertThatThrownBy(() -> bootstrapService.executeBootstrap(TARGET_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("conflicting state");
    }

    @Test
    @DisplayName("5. Bootstrap idempotent: Repeated execution returns ALREADY_PROVISIONED cleanly")
    void testBootstrapIdempotent_WhenAlreadyProvisioned() {
        BootstrapResult firstResult = bootstrapService.executeBootstrap(TARGET_EMAIL);
        assertThat(firstResult.getStatus()).isEqualTo(BootstrapResult.Status.CREATED);

        // Run second time
        BootstrapResult secondResult = bootstrapService.executeBootstrap(TARGET_EMAIL);
        assertThat(secondResult.getStatus()).isEqualTo(BootstrapResult.Status.ALREADY_PROVISIONED);
        assertThat(secondResult.getUserId()).isEqualTo(firstResult.getUserId());

        assertThat(userRepository.count()).isEqualTo(1L);
    }

    @Test
    @DisplayName("6. Transaction rollback: Entire transaction rolls back cleanly on unexpected failure")
    void testBootstrapTransactionRollback_OnFailure() {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        assertThatThrownBy(() -> txTemplate.execute(status -> {
            bootstrapService.executeBootstrap(TARGET_EMAIL);
            // Simulate sudden downstream failure right after bootstrap call
            throw new RuntimeException("Simulated unexpected post-bootstrap error forcing transaction rollback");
        })).isInstanceOf(RuntimeException.class)
           .hasMessageContaining("Simulated unexpected");

        // Verify that database changes rolled back completely
        assertThat(userRepository.findByEmailIgnoreCase(TARGET_EMAIL)).isEmpty();
        assertThat(userPermissionRepository.count()).isZero();
    }

    @Test
    @DisplayName("7. Advisory lock guard: Fails immediately when advisory lock cannot be acquired")
    void testBootstrapAdvisoryLockFailure_AbortsExecution() {
        FirstOwnerBootstrapService serviceWithFailingLock = new FirstOwnerBootstrapService(
                entityManager, userRepository, roleRepository, userPermissionRepository
        ) {
            @Override
            boolean acquirePostgresAdvisoryLock() {
                // Simulate another process holding the PostgreSQL transaction advisory lock
                return false;
            }
        };

        assertThatThrownBy(() -> serviceWithFailingLock.executeBootstrap(TARGET_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Another first-owner bootstrap is currently executing");

        assertThat(userRepository.findByEmailIgnoreCase(TARGET_EMAIL)).isEmpty();
    }

    @Test
    @DisplayName("8. Concurrency protection: Multi-threaded invocation produces exactly one owner")
    void testBootstrapConcurrentInvocation() throws Exception {
        int threadCount = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger alreadyProvisionedCount = new AtomicInteger(0);
        AtomicInteger refusedCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    BootstrapResult result = bootstrapService.executeBootstrap(TARGET_EMAIL);
                    if (result.getStatus() == BootstrapResult.Status.CREATED) {
                        successCount.incrementAndGet();
                    } else {
                        alreadyProvisionedCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    refusedCount.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Release all threads simultaneously
        startLatch.countDown();
        boolean completed = doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(completed).isTrue();
        // Exactly one user must exist
        assertThat(userRepository.count()).isEqualTo(1L);
        // And that user must be the active owner
        User user = userRepository.findByEmailIgnoreCase(TARGET_EMAIL).orElseThrow();
        assertThat(user.isActive()).isTrue();
        assertThat(user.getRoles()).extracting(Role::getName).containsExactly("owner");
    }

    @Test
    @DisplayName("9. Identity auto-linking: First login with verified Firebase token links UID and retains owner role")
    void testIdentityLinking_OnSubsequentAuthenticatedLogin() {
        // 1. Provision account via bootstrap
        bootstrapService.executeBootstrap(TARGET_EMAIL);

        User bootstrappedUser = userRepository.findByEmailIgnoreCase(TARGET_EMAIL).orElseThrow();
        assertThat(bootstrappedUser.getFirebaseUid()).isNull();
        assertThat(bootstrappedUser.isActive()).isTrue();

        // 2. Simulate verified Firebase token from frontend login
        String realFirebaseUid = "firebase-owner-uid-verified-98765";
        FirebaseTokenHolder tokenHolder = FirebaseTokenHolder.builder()
                .uid(realFirebaseUid)
                .email(TARGET_EMAIL)
                .emailVerified(true)
                .claims(Collections.emptyMap())
                .build();

        // 3. UserSecurityService.findAndLinkUser executes
        Optional<User> linkedUserOpt = userSecurityService.findAndLinkUser(tokenHolder);

        assertThat(linkedUserOpt).isPresent();
        User linkedUser = linkedUserOpt.get();
        assertThat(linkedUser.getFirebaseUid()).isEqualTo(realFirebaseUid);
        assertThat(linkedUser.getEmail()).isEqualTo(TARGET_EMAIL);
        assertThat(linkedUser.isActive()).isTrue();
        assertThat(linkedUser.getRoles()).extracting(Role::getName).containsExactly("owner");
        assertThat(linkedUser.getPermissions().isManageUsers()).isTrue();
        assertThat(linkedUser.getPermissions().isManageAppointments()).isTrue();

        // 4. Verify in database
        User persisted = userRepository.findById(bootstrappedUser.getId()).orElseThrow();
        assertThat(persisted.getFirebaseUid()).isEqualTo(realFirebaseUid);
    }

    @Test
    @DisplayName("10. Execution gates: Runner honors CLI switch, validates secret length, and rejects placeholders")
    void testRunnerExecutionGates() {
        FirstOwnerBootstrapProperties properties = new FirstOwnerBootstrapProperties();
        properties.setEnabled(true);

        FirstOwnerBootstrapRunner runner = new FirstOwnerBootstrapRunner(properties, bootstrapService);

        // Gate 1: When CLI switch --bootstrap-first-owner is NOT passed, runner exits immediately
        DefaultApplicationArguments noArgs = new DefaultApplicationArguments();
        runner.run(noArgs);
        assertThat(userRepository.count()).isZero();

        // Gate 2: When CLI switch is passed but secret is missing, throws SecurityException
        DefaultApplicationArguments bootstrapArgs = new DefaultApplicationArguments("--bootstrap-first-owner");
        assertThatThrownBy(() -> runner.run(bootstrapArgs))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("APP_BOOTSTRAP_FIRST_OWNER_SECRET must be set");

        // Gate 3: Secret shorter than 32 characters throws SecurityException
        properties.setSecret("short-secret-1234");
        assertThatThrownBy(() -> runner.run(bootstrapArgs))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("at least 32 characters");

        // Gate 4: Secret containing placeholder throws SecurityException
        properties.setSecret("change-me-this-is-longer-than-32-characters-placeholder");
        assertThatThrownBy(() -> runner.run(bootstrapArgs))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("insecure placeholder value");

        // Gate 5: Valid secret (>= 32 chars) executes successfully
        properties.setSecret(VALID_SECRET);
        runner.run(bootstrapArgs);
        assertThat(userRepository.findByEmailIgnoreCase(TARGET_EMAIL)).isPresent();
    }

    @Test
    @DisplayName("11. Target email immutability: Refuses attempt to provision alternate email")
    void testBootstrapRefusesAlternateEmail() {
        assertThatThrownBy(() -> bootstrapService.executeBootstrap("attacker@evil.com"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("Bootstrap target email is strictly immutable");

        assertThat(userRepository.count()).isZero();
    }
}
