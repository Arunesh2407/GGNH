package com.ggnh.hub.security.bootstrap;

import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.entity.UserPermission;
import com.ggnh.hub.repository.RoleRepository;
import com.ggnh.hub.repository.UserPermissionRepository;
import com.ggnh.hub.repository.UserRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Service managing transactional checks, concurrency protection, and database writes
 * for the one-time first-owner bootstrap.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FirstOwnerBootstrapService {

    /**
     * Unique 64-bit advisory lock key derived from ASCII hex for "GGNH_OWN".
     */
    public static final long BOOTSTRAP_ADVISORY_LOCK_ID = 0x47474E485F4F574EL;

    /**
     * Strictly hardcoded, immutable target email for the first-owner bootstrap.
     * Cannot be overridden via configuration, environment variables, or CLI arguments.
     */
    public static final String BOOTSTRAP_TARGET_EMAIL = "ggnhpvtltd@gmail.com";

    private final EntityManager entityManager;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserPermissionRepository userPermissionRepository;

    /**
     * Executes the first-owner bootstrap for the immutable target email.
     */
    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED)
    public BootstrapResult executeBootstrap() {
        return executeBootstrap(BOOTSTRAP_TARGET_EMAIL);
    }

    /**
     * Executes the first-owner bootstrap within a single transaction.
     * The PostgreSQL advisory transaction lock is acquired on the same JDBC connection and transaction.
     * Rejects any target email other than the immutable BOOTSTRAP_TARGET_EMAIL.
     */
    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED)
    public BootstrapResult executeBootstrap(String targetEmail) {
        if (targetEmail == null || !BOOTSTRAP_TARGET_EMAIL.equalsIgnoreCase(targetEmail.trim())) {
            throw new SecurityException("Bootstrap target email is strictly immutable ('" + BOOTSTRAP_TARGET_EMAIL
                    + "'). Refusing attempt to provision alternate email: " + targetEmail);
        }

        log.info("Initiating first-owner bootstrap transaction");

        // 1. Acquire PostgreSQL advisory transaction lock on current connection
        if (!acquirePostgresAdvisoryLock()) {
            throw new IllegalStateException("Another first-owner bootstrap is currently executing or holding the advisory lock.");
        }

        // 2. Pre-execution guard: inspect target account state
        String normalizedEmail = targetEmail.trim().toLowerCase();
        Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();

            // Refuse if already linked to a Firebase UID
            if (existingUser.getFirebaseUid() != null && !existingUser.getFirebaseUid().isBlank()) {
                throw new IllegalStateException("Refusing bootstrap: target email is already mapped to a Firebase UID.");
            }

            // Check if existing user is already configured as owner
            boolean isOwner = existingUser.getRoles() != null && existingUser.getRoles().stream()
                    .anyMatch(r -> "owner".equalsIgnoreCase(r.getName()));

            if (!isOwner || !existingUser.isActive()) {
                throw new IllegalStateException("Refusing bootstrap: target user exists in a conflicting state. Silent promotion is prohibited.");
            }

            log.info("First-owner bootstrap target account is already provisioned with owner role and pending Firebase UID linking.");
            return BootstrapResult.alreadyProvisioned(existingUser.getId());
        }

        // 3. Pre-execution guard: active owner count
        long activeOwners = userRepository.countActiveOwners();
        if (activeOwners > 0) {
            throw new IllegalStateException("Refusing bootstrap: an active owner already exists in the system.");
        }

        // 4. Resolve 'owner' role
        Role ownerRole = roleRepository.findByName("owner")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("owner")
                        .description("Hospital owner / super administrator with full system authority")
                        .build()));

        Set<Role> roles = new HashSet<>();
        roles.add(ownerRole);

        // 5. Provision user with null firebase_uid and is_active = true
        User user = User.builder()
                .email(normalizedEmail)
                .firebaseUid(null)
                .isActive(true)
                .createdBy("SYSTEM_BOOTSTRAP")
                .roles(roles)
                .build();

        User savedUser = userRepository.save(user);

        // 6. Provision all five permissions
        UserPermission permissions = UserPermission.builder()
                .user(savedUser)
                .manageAttendance(true)
                .manageAppointments(true)
                .manageUsers(true)
                .manageInventory(true)
                .manageInventoryReports(true)
                .build();

        userPermissionRepository.save(permissions);
        savedUser.setPermissions(permissions);

        log.info("First-owner bootstrap completed successfully: owner account created and activated.");
        return BootstrapResult.created(savedUser.getId());
    }

    /**
     * Acquires PostgreSQL advisory transaction lock on the current transactional connection.
     * In PostgreSQL, pg_try_advisory_xact_lock ensures atomic mutual exclusion across concurrent transactions.
     * The lock is automatically released upon commit or rollback of this transaction.
     */
    boolean acquirePostgresAdvisoryLock() {
        if (!isPostgresDatabase()) {
            log.debug("Advisory transaction lock skipped: database is not PostgreSQL.");
            return true;
        }

        try {
            Object result = entityManager.createNativeQuery("SELECT pg_try_advisory_xact_lock(:lockId)")
                    .setParameter("lockId", BOOTSTRAP_ADVISORY_LOCK_ID)
                    .getSingleResult();
            if (result instanceof Boolean b) {
                return b;
            }
            return true;
        } catch (Exception ex) {
            log.error("Failed to acquire PostgreSQL advisory transaction lock: {}", ex.getMessage());
            return false;
        }
    }

    private boolean isPostgresDatabase() {
        try {
            org.hibernate.Session session = entityManager.unwrap(org.hibernate.Session.class);
            return Boolean.TRUE.equals(session.doReturningWork(connection -> {
                String productName = connection.getMetaData().getDatabaseProductName();
                return productName != null && productName.toLowerCase().contains("postgresql");
            }));
        } catch (Exception e) {
            log.warn("Could not determine database product name: {}", e.getMessage());
            return false;
        }
    }
}
