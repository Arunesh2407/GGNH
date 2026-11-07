# Security Remediation Report — Firebase Authentication & RBAC

**Target System**: GG Nursing Home Hub (Spring Boot 3.2.5 / Java 17 / PostgreSQL)  
**Remediation Scope**: Task 3.2 — Remediation of vulnerabilities identified in Task 3.1 (`docs/AUTHENTICATION_SECURITY_REVIEW.md`)  
**Date**: November 1, 2026  
**Status**: COMPLETE — ALL 7 CONFIRMED VULNERABILITIES REMEDIATED & VERIFIED  

---

## 1. Executive Summary

During Task 3.1, an application security review identified 1 Critical, 2 High, 2 Medium, and 2 Low severity vulnerabilities spanning identity verification, authorization logic, filter lifecycle management, input validation, and endpoint abuse.

In Task 3.2, all 7 vulnerabilities have been remediated in the backend service and security layers without modifying frontend components, without altering existing database migrations, and without connecting to external production infrastructure. A comprehensive regression test suite comprising 26 dedicated regression tests (44 total backend tests) was added. All tests execute deterministically and pass with zero failures and zero errors.

### Final Integration Recommendation: **GO FOR FRONTEND INTEGRATION**
With unverified email linking blocked, administrative self-escalation prevented, owner accounts shielded, staff/attendance read endpoints restricted, appointment input strictly bounded, SecurityContext cleanup guaranteed across all filter branches, and public endpoints rate-limited, the backend security architecture satisfies production security criteria for frontend API integration.

---

## 2. Remediation Matrix & Summary of Changes

| Finding ID | Severity | Original Vulnerability | Root Cause | Exact Fix | Files Changed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | Pre-Account Takeover via Unverified Email Linking | Automatic UID linking occurred on email match without verifying `decodedToken.isEmailVerified()`. | Enforce `tokenHolder.isEmailVerified() == true` before automatic linking in `findAndLinkUser` and reject unverified tokens on `/auth/register` and `/auth/sync` with HTTP 403 Forbidden. Validate against cross-UID and email conflicts. | `UserSecurityService.java`, `AuthController.java`, `FirebaseAuthenticationFilter.java` |
| **SEC-02** | **HIGH** | Privilege Escalation via Self-Access Modification | No check existed to prevent delegated administrators with `PERM_MANAGE_USERS` from modifying their own roles/permissions. | Added `validateAccessUpdate` in `UserSecurityService` business layer: prohibits self-modification for all administrators, restricts owner-role assignment and owner-account modification strictly to existing owners. | `UserSecurityService.java`, `UserAccessController.java` |
| **SEC-03** | **HIGH** | Delegated Manager Can Deactivate Hospital Owner | `PATCH /users/{id}/status` only prevented self-deactivation; it did not inspect the target account's roles. | Added `validateStatusUpdate` in `UserSecurityService`: forbids delegated managers from deactivating an owner; restricts owner deactivation to other owners; prevents deactivating the last active owner. | `UserSecurityService.java`, `UserAccessController.java`, `UserRepository.java` |
| **SEC-04** | **MEDIUM** | SecurityContext Leak on Registration Path | Registration branch in `FirebaseAuthenticationFilter` lacked a `finally { SecurityContextHolder.clearContext(); }` block before early return. | Wrapped registration dispatch in `try ... finally { SecurityContextHolder.clearContext(); }`. | `FirebaseAuthenticationFilter.java` |
| **SEC-05** | **MEDIUM** | Missing Read Authorization on Staff Directory & Attendance | `GET /staff`, `GET /staff/{id}`, and `GET /attendance` lacked `@PreAuthorize`, permitting any authenticated user (e.g. viewers or store managers) to harvest staff PII and rosters. | Applied `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")` across all staff directory and attendance read endpoints. | `StaffController.java`, `AttendanceController.java` |
| **SEC-06** | **LOW** | Entity Mass Assignment on Public Appointment Booking | `POST /appointments` deserialized request body directly into JPA `Appointment` entity, allowing callers to supply `status: completed`, `completedAt`, or `id`. | Created `CreateAppointmentRequest` DTO with validated fields; server explicitly sets `status = BOOKED`, `createdAt = OffsetDateTime.now()`, and `completedAt = null`. | `CreateAppointmentRequest.java`, `AppointmentController.java` |
| **SEC-07** | **LOW** | Absence of Rate Limiting on Public Endpoints | No rate limiting on public booking or registration endpoints, exposing them to credential spam and denial of service. | Implemented `RateLimitingFilter`, `InMemoryRateLimiter`, and `RateLimitProperties` using an in-memory sliding window algorithm. Returns HTTP 429 Too Many Requests; avoids logging sensitive body payloads; safeguards against IP spoofing. | `RateLimitProperties.java`, `InMemoryRateLimiter.java`, `RateLimitingFilter.java`, `SecurityConfig.java`, `application.yml`, `application-test.yml` |

---

## 3. Detailed Vulnerability Analyses & Exact Fixes

### SEC-01: Pre-Account Takeover via Unverified Email Identity Linking (CRITICAL)

#### Root Cause
In `UserSecurityService.findAndLinkUser` and `AuthController.registerOrSync`, an incoming Firebase Bearer token was matched against database accounts by email address. If an existing account matched the email and had `firebase_uid == null`, the server immediately stamped the token's UID onto the database record without checking `tokenHolder.isEmailVerified()`. An attacker could sign up on Firebase with a victim's email address (e.g. `owner@ggnh.org`), bypass verification, and acquire full super-admin access.

#### Exact Fix
1. In `UserSecurityService.findAndLinkUser`:
   - Enforce `if (!tokenHolder.isEmailVerified()) { return Optional.empty(); }` before linking any existing database user.
   - Verify that the Firebase UID is not already claimed by a different database user.
   - Detect and reject UID-to-email identity collisions.
2. In `AuthController.registerOrSync`:
   - Reject unverified email tokens immediately with `HTTP 403 Forbidden` (`ResponseStatusException(HttpStatus.FORBIDDEN, "Email address must be verified...")`).
   - Validate UID and email uniqueness before account provisioning or linking.
3. In `FirebaseAuthenticationFilter.doFilterInternal`:
   - For unregistered paths, reject unverified tokens with HTTP 403 Forbidden before reaching the controller.

#### Regression Tests Added
- `verifiedEmail_MatchingExistingUnlinkedAccount_LinksSuccessfully`: Proves that legitimate verified accounts safely link their Firebase UID and authenticate (200 OK).
- `unverifiedEmail_MatchingExistingOwner_IsRejectedAndNotModified`: Proves that an attacker with an unverified token matching an active owner account is rejected (401 Unauthorized), and that the owner's database record remains unmodified with `firebase_uid == null`.
- `verifiedEmail_ConflictingFirebaseUid_IsRejected`: Proves that presenting a verified token with a conflicting UID does not overwrite an existing user's linked UID.
- `unknownUser_VerifiedEmail_CannotAccessProtectedMe_CanRegister`: Proves that a verified identity unknown to the database cannot access protected routes without registering.
- `registration_WithUnverifiedEmail_IsRejected`: Proves that registration with an unverified email returns 403 Forbidden and creates no database record.
- `synchronization_WithUnverifiedEmail_IsRejected`: Proves that synchronization with an unverified email returns 403 Forbidden.

---

### SEC-02: Self-Permission Escalation (HIGH)

#### Root Cause
`PUT /users/{id}/access` permitted anyone with `PERM_MANAGE_USERS` to update user roles and permissions. The controller only verified that a non-owner could not assign the `owner` role, but lacked any check preventing an administrator from targeting their own user UUID. Consequently, a delegated manager could grant themselves all granular permissions (`manageInventory`, `manageAttendance`, `manageAppointments`, `manageInventoryReports`).

#### Exact Fix
Encapsulated authorization business rules inside `UserSecurityService.validateAccessUpdate(currentAdmin, targetUser, newRole, newPermissions)`:
1. **Self-Modification Prohibited**: If `currentAdmin.getId().equals(targetUser.getId())`, throw `HttpStatus.FORBIDDEN ("Administrators cannot modify their own roles or permissions.")`. This applies to all administrators, preventing both delegated privilege escalation and accidental owner self-demotion.
2. **Owner Account Modification Protected**: Non-owners cannot alter the roles or permissions of an account that currently holds the `owner` role (`HttpStatus.FORBIDDEN`).
3. **Owner Role Grant Protected**: Only an existing owner can assign the `owner` role (`HttpStatus.FORBIDDEN`).

#### Regression Tests Added
- `delegatedManager_ModifyingOwnPermissions_IsForbidden`: Proves a delegated manager cannot escalate their own permissions (403 Forbidden).
- `delegatedManager_ModifyingAnotherNormalUser_IsAllowed`: Proves legitimate delegated user management continues to work for subordinate accounts.
- `delegatedManager_GrantingOwnerRole_IsForbidden`: Proves a delegated manager cannot promote anyone to owner (403 Forbidden).
- `owner_GrantingOwnerRoleToAnotherUser_IsAllowed`: Proves an existing owner can promote another user to owner.
- `owner_ModifyingOwnPermissions_IsForbidden`: Proves an owner cannot modify their own permissions or demote themselves.
- `unauthorizedUser_AttemptingToModifyTarget_IsForbidden`: Proves an unauthorized user without user-management authority is blocked (403 Forbidden).

---

### SEC-03: Delegated User Manager Can Deactivate Hospital Owner (HIGH)

#### Root Cause
`PATCH /users/{id}/status` checked `currentAdmin.getId().equals(user.getId())` to prevent self-deactivation, but failed to inspect the target user's role. A user with `PERM_MANAGE_USERS` could submit `{ "active": false }` for any owner account, disabling the hospital owner's access. Furthermore, if an owner deactivated another owner, no check ensured that at least one active owner remained.

#### Exact Fix
1. Added `countActiveOwners()` query to `UserRepository`:
   ```sql
   SELECT COUNT(u) FROM User u JOIN u.roles r WHERE LOWER(r.name) = 'owner' AND u.isActive = true
   ```
2. Implemented `UserSecurityService.validateStatusUpdate(currentAdmin, targetUser, newActive)`:
   - Self-deactivation safeguard preserved (`HttpStatus.BAD_REQUEST`).
   - If target user is an owner and `newActive == false`:
     - Delegated non-owner administrators are rejected with `HttpStatus.FORBIDDEN ("Only an owner can modify or deactivate an owner account.")`.
     - If the current admin is an owner, verify `userRepository.countActiveOwners() > 1`. If only 1 active owner remains, reject with `HttpStatus.BAD_REQUEST ("Cannot deactivate the last active owner.")`.

#### Regression Tests Added
- `delegatedManager_DeactivatingOwner_IsForbidden`: Proves a delegated manager cannot deactivate an owner (403 Forbidden).
- `owner_DeactivatingAnotherOwner_IsAllowed`: Proves an owner can deactivate another owner when multiple active owners exist.
- `deactivatingLastActiveOwner_IsBadRequest`: Proves deactivating the system's sole active owner is rejected (400 Bad Request).
- `deactivatingNormalUser_WithDelegatedPermission_IsAllowed`: Proves delegated managers can deactivate standard non-owner accounts.
- `administrator_AttemptingSelfDeactivation_IsBadRequest`: Proves administrators cannot deactivate their own accounts (400 Bad Request).

---

### SEC-04: ThreadLocal SecurityContext Leak on Registration Path (MEDIUM)

#### Root Cause
In `FirebaseAuthenticationFilter.doFilterInternal`, normal authenticated requests executed downstream filters inside `try { filterChain.doFilter(...) } finally { SecurityContextHolder.clearContext(); }`. However, when handling unregistered identities on registration/sync paths (`isRegistrationPath == true`), the filter assigned a temporary `FirebaseAuthenticationToken` with `ROLE_UNREGISTERED` and called `filterChain.doFilter(request, response); return;` without a `finally` block. If the thread was returned to the servlet thread pool without clearing, subsequent requests on that thread risked inheriting residual authentication.

#### Exact Fix
Wrapped the registration filter invocation in `try ... finally`:
```java
SecurityContextHolder.getContext().setAuthentication(auth);
try {
    filterChain.doFilter(request, response);
} finally {
    SecurityContextHolder.clearContext();
}
return;
```

#### Documented Filter Lifecycle & Ordering
1. `SecurityContextHolderFilter`: Sets deferred SecurityContext, clears on exit.
2. `CorsFilter`: Processes CORS headers and options preflights.
3. `RateLimitingFilter`: Throttles brute force / abuse before authentication.
4. `LogoutFilter`: Dispatches logout handlers.
5. `FirebaseAuthenticationFilter`: Verifies Firebase Bearer token, maps to database user, sets principal and authorities. Guarantees `SecurityContextHolder.clearContext()` on **all** execution paths (authenticated, unregistered, and exceptions).
6. Downstream Spring Security filters: `RequestCacheAwareFilter`, `SecurityContextHolderAwareRequestFilter`, `AnonymousAuthenticationFilter`, `SessionManagementFilter`, `ExceptionTranslationFilter`, `AuthorizationFilter`.

#### Regression Test Added
- `unregisteredUser_SecurityContext_ClearedAndDoesNotLeak`: Verifies that after an unregistered user calls `POST /auth/register`, `SecurityContextHolder.getContext().getAuthentication()` is null, and a subsequent unauthenticated call on the same thread returns 401 Unauthorized.

---

### SEC-05: Staff Directory & Attendance Read Authorization (MEDIUM)

#### Root Cause
`StaffController.getAllStaff()`, `StaffController.getStaffById()`, and `AttendanceController.getAllAttendance()` lacked method-level security annotations. Although Spring Security enforced `.anyRequest().authenticated()`, any authenticated user—including read-only `viewer` accounts or inventory-only `store-manager` accounts—could retrieve staff personal contact numbers, email addresses, and detailed daily attendance rosters.

#### Exact Fix
Annotated all read endpoints with `@PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_ATTENDANCE')")`:
- `GET /staff`
- `GET /staff/{id}`
- `GET /attendance`

#### Final Access Matrix

| Endpoint | HTTP Method | Permitted Roles & Authorities | Unauthorized Roles (HTTP 403) |
| :--- | :--- | :--- | :--- |
| `/staff` | `GET` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer` (unauthorized), `store-manager`, `department-head`, `auditor` |
| `/staff/{id}` | `GET` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer` (unauthorized), `store-manager`, `department-head`, `auditor` |
| `/staff` | `POST` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer`, `store-manager`, `department-head`, `auditor` |
| `/staff/{id}` | `PUT` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer`, `store-manager`, `department-head`, `auditor` |
| `/staff/{id}` | `DELETE` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer`, `store-manager`, `department-head`, `auditor` |
| `/attendance` | `GET` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer` (unauthorized), `store-manager`, `department-head`, `auditor` |
| `/attendance/mark` | `POST` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer`, `store-manager`, `department-head`, `auditor` |
| `/attendance` | `DELETE` | `owner`, `editor`, users with `PERM_MANAGE_ATTENDANCE` | `viewer`, `store-manager`, `department-head`, `auditor` |

#### Regression Tests Added
- `unauthorizedViewer_CannotReadStaffOrAttendance`: Normal `viewer` without attendance permission receives 403 Forbidden across `/staff`, `/staff/{id}`, and `/attendance`.
- `authorizedViewer_WithManageAttendance_CanReadStaffAndAttendance`: Viewer explicitly granted `manageAttendance` successfully reads records (200 OK).
- `storeManager_CannotReadStaffOrAttendance`: Inventory `store-manager` is forbidden from reading staff PII or attendance rosters (403 Forbidden).
- `attendanceManager_CanReadStaffAndAttendance`: Clinical `editor` with attendance authority reads records (200 OK).
- `owner_CanReadStaffAndAttendance`: Hospital `owner` reads records (200 OK).
- `unauthenticatedRequest_CannotReadStaffOrAttendance`: Unauthenticated caller receives 401 Unauthorized.

---

### SEC-06: Entity Mass Assignment on Public Appointment Booking (LOW)

#### Root Cause
`AppointmentController.createAppointment(@Valid @RequestBody Appointment appointment)` bound incoming client JSON directly to the JPA entity. An unauthenticated public user could pass `id`, `status: "completed"`, or `completedAt`, bypassing clinical workflows and corrupting appointment records.

#### Exact Fix
1. Created `CreateAppointmentRequest` DTO containing only public submission fields:
   - `patientName`: `@NotBlank`, `@Size(max = 200)`
   - `patientEmail`: `@NotBlank`, `@Email`, `@Size(max = 255)`
   - `patientPhone`: `@NotBlank`, `@Size(max = 50)`
   - `doctorName`: `@NotBlank`, `@Size(max = 150)`
   - `message`: `@Size(max = 2000)`
2. In `AppointmentController.createAppointment`:
   - Bind request to `CreateAppointmentRequest`.
   - Build `Appointment` entity server-side: force `status = AppointmentStatus.BOOKED`, `createdAt = OffsetDateTime.now()`, `completedAt = null`, and let JPA generate the UUID `id`.

#### Regression Test Added
- `attemptToSubmitStatusCompleted_IsOverriddenToServerBooked`: Proves that client attempts to submit `status: completed`, `completedAt`, or custom `id` are completely ignored; persisted entity has `status = booked`, `completedAt = null`, and server-generated ID.

---

### SEC-07: Public Endpoint Abuse Protection & Rate Limiting (LOW)

#### Root Cause
Public endpoints (`POST /appointments`, `POST /auth/register`, `POST /auth/sync`) had no request throttling or rate limiting, exposing the backend to spam, resource exhaustion, and automated registration attacks.

#### Exact Fix
1. Implemented `RateLimitProperties` (`app.rate-limit.*`):
   - `enabled`: default `true`
   - `appointments-per-minute`: default `10`
   - `auth-per-minute`: default `10`
   - `trust-proxy-headers`: default `false` (prevents IP spoofing via forged `X-Forwarded-For` headers)
2. Implemented `InMemoryRateLimiter`: Thread-safe sliding window tracking per client key over a 60-second window. Includes `reset()` method for test isolation.
3. Implemented `RateLimitingFilter`: Extends `OncePerRequestFilter`, registered after `CorsFilter` and before authentication filters.
   - Intercepts `POST /appointments`, `POST /auth/register`, and `POST /auth/sync`.
   - Returns standardized JSON with `HTTP 429 Too Many Requests` when limits are exceeded.
   - Logs only client IP and endpoint category; never logs sensitive request bodies.

#### Reverse Proxy Limitations & Production Recommendations
- In local development and single-container deployments, client IP is derived from `request.getRemoteAddr()`.
- **IP Spoofing Protection**: `trustProxyHeaders` defaults to `false` because directly accessible servers cannot trust client-supplied `X-Forwarded-For` headers.
- **Production Recommendation**: When deployed behind an authenticating reverse proxy or API gateway (Cloudflare, AWS ALB, Nginx), configure the edge proxy to strip untrusted incoming forwarding headers and set `RATE_LIMIT_TRUST_PROXY_HEADERS=true`. For multi-instance clustered deployments, replace `InMemoryRateLimiter` with a Redis-backed rate limiter (e.g. Bucket4j with Lettuce/Redis).

#### Regression Test Added
- `exceedingRateLimit_Returns429TooManyRequests`: Proves that exceeding configured request thresholds triggers HTTP 429 Too Many Requests with standardized error JSON.

---

## 4. Test Suite Execution Results

### Command Executed
```bash
cd backend
mvn clean test
```

### Execution Log Summary
```
[INFO] Scanning for projects...
[INFO] -----------------------< com.ggnh:ggnh-backend >------------------------
[INFO] Building ggnh-backend 0.0.1-SNAPSHOT
[INFO]   from pom.xml
[INFO] --------------------------------[ jar ]---------------------------------
[INFO] 
[INFO] --- clean:3.3.2:clean (default-clean) @ ggnh-backend ---
[INFO] --- resources:3.3.1:resources (default-resources) @ ggnh-backend ---
[INFO] --- compiler:3.11.0:compile (default-compile) @ ggnh-backend ---
[INFO] Compiling 56 source files with javac [debug release 17] to target\classes
[INFO] --- resources:3.3.1:testResources (default-testResources) @ ggnh-backend ---
[INFO] --- compiler:3.11.0:testCompile (default-testCompile) @ ggnh-backend ---
[INFO] Compiling 5 source files with javac [debug release 17] to target\test-classes
[INFO] --- surefire:3.1.2:test (default-test) @ ggnh-backend ---
[INFO] Running com.ggnh.hub.GgnhApplicationTests
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.ggnh.hub.PostgresFlywayIntegrationTest
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 1
[INFO] Running com.ggnh.hub.RepositoryIntegrationTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.ggnh.hub.security.AuthenticationSecurityIntegrationTest
[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.ggnh.hub.security.SecurityRemediationRegressionTest
[INFO] Tests run: 26, Failures: 0, Errors: 0, Skipped: 0 (across 7 nested scenario suites)
[INFO] 
[INFO] Results:
[INFO] 
[WARNING] Tests run: 44, Failures: 0, Errors: 0, Skipped: 1
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  38.450 s
[INFO] Finished at: 2026-11-01T00:16:38+05:30
```

### Exit Code
`0` (BUILD SUCCESS)

### Skipped Tests
`PostgresFlywayIntegrationTest` (1 test): Conditionally skipped via `@EnabledIfEnvironmentVariable(named = "VERIFY_POSTGRES", matches = "true")`. This test is designed to run against a live local PostgreSQL instance and is intentionally skipped in standard builds where no PostgreSQL daemon is running.

---

## 5. Remaining Risks & Deferred Architectural Decisions

1. **In-Memory Rate Limiting in Clustered Environments**:
   `InMemoryRateLimiter` tracks request buckets in JVM memory. If the backend is horizontally scaled across multiple container instances without sticky sessions or an edge rate limiter, each instance tracks its own quota independently. In production, edge rate limiting (Cloudflare / AWS WAF) or a shared Redis store should be introduced.
2. **Granular Staff Directory Privacy (Unresolved Business Rule)**:
   Currently, any user holding `PERM_MANAGE_ATTENDANCE` (or `ROLE_owner` / `ROLE_editor`) can view staff phone numbers and email addresses. If medical staff personal contact details must be restricted exclusively to HR/Owner administrators while allowing clinical coordinators to view only names and attendance statuses, a separate `StaffSummaryDto` (excluding phone and email) should be introduced for non-HR clinical roles in a future task.
3. **Database Migration to Hosted Supabase**:
   Flyway migration `V3__add_firebase_identity_mapping.sql` has been verified in local H2 test configurations, but has not yet been applied to the live hosted Supabase instance. Migration execution should take place during planned maintenance before pointing client applications to the backend.

---

## 6. Final GO/NO-GO Recommendation

### Verdict: **GO FOR FRONTEND INTEGRATION**

All 7 security vulnerabilities identified during Task 3.1 have been comprehensively remediated and verified with regression tests. The Spring Boot backend enforces strict single-source-of-truth authorization in PostgreSQL, rejects unverified identities, protects owner and administrative accounts from privilege escalation and denial of service, protects staff PII, prevents mass assignment, cleanly manages SecurityContext lifecycles, and mitigates public endpoint abuse.

The project is ready to proceed to Task 4 (Frontend API Integration).

