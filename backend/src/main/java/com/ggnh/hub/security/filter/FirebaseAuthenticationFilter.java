package com.ggnh.hub.security.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.entity.Role;
import com.ggnh.hub.entity.User;
import com.ggnh.hub.repository.UserRepository;
import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import com.ggnh.hub.security.firebase.FirebaseTokenVerifier;
import com.ggnh.hub.security.model.FirebaseAuthenticationToken;
import com.ggnh.hub.security.model.FirebaseUserDetails;
import com.ggnh.hub.security.service.UserSecurityService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    public static final String REGISTRATION_URI_SUFFIX = "/auth/register";
    public static final String SYNC_URI_SUFFIX = "/auth/sync";
    public static final String FIREBASE_TOKEN_ATTRIBUTE = "FIREBASE_TOKEN_HOLDER";

    private final FirebaseTokenVerifier tokenVerifier;
    private final UserSecurityService userSecurityService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // If no Bearer token, continue filter chain (anonymous or public endpoints handled by Spring Security)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String idToken = authHeader.substring(7).trim();
        if (idToken.isEmpty()) {
            sendJsonError(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized",
                    "Bearer token is empty.", request.getRequestURI());
            return;
        }

        FirebaseTokenHolder tokenHolder;
        try {
            tokenHolder = tokenVerifier.verifyToken(idToken);
        } catch (Exception e) {
            log.warn("Firebase ID token verification failed for request {}: {}", request.getRequestURI(), e.getMessage());
            sendJsonError(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized",
                    "Invalid, expired, or revoked Firebase token: " + e.getMessage(), request.getRequestURI());
            return;
        }

        if (tokenHolder == null || tokenHolder.getUid() == null || tokenHolder.getUid().isBlank()) {
            sendJsonError(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized",
                    "Token did not contain a valid Firebase UID.", request.getRequestURI());
            return;
        }

        // Attach verified token to request for optional controller inspection
        request.setAttribute(FIREBASE_TOKEN_ATTRIBUTE, tokenHolder);

        // Load application user from PostgreSQL via service
        Optional<User> optionalUser = userSecurityService.findAndLinkUser(tokenHolder);

        boolean isRegistrationPath = isRegistrationRequest(request);

        if (optionalUser.isEmpty()) {
            if (isRegistrationPath) {
                // SEC-01: Ensure unverified emails cannot proceed to registration or sync
                if (!tokenHolder.isEmailVerified()) {
                    log.warn("Unverified email '{}' attempted registration/sync at {}", tokenHolder.getEmail(), request.getRequestURI());
                    sendJsonError(response, HttpStatus.FORBIDDEN.value(), "Forbidden",
                            "Email address is not verified in Firebase.", request.getRequestURI());
                    return;
                }

                // Allow through to registration endpoint with unregistered token
                FirebaseUserDetails unregisteredPrincipal = createUnregisteredPrincipal(tokenHolder);
                FirebaseAuthenticationToken auth = new FirebaseAuthenticationToken(
                        unregisteredPrincipal,
                        tokenHolder,
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_UNREGISTERED"))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
                // SEC-04: Guarantee SecurityContext cleanup in finally block
                try {
                    filterChain.doFilter(request, response);
                } finally {
                    SecurityContextHolder.clearContext();
                }
                return;
            }

            log.warn("Unknown Firebase identity UID '{}' attempted access to {}", tokenHolder.getUid(), request.getRequestURI());
            sendJsonError(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized",
                    "User account not found in database. Contact administrator or register.", request.getRequestURI());
            return;
        }

        User user = optionalUser.get();

        // Reject inactive or unapproved accounts
        if (!user.isActive()) {
            log.warn("Inactive/unapproved user '{}' attempted access to {}", user.getEmail(), request.getRequestURI());
            sendJsonError(response, HttpStatus.FORBIDDEN.value(), "Forbidden",
                    "Account pending approval or inactive. Please contact an administrator.", request.getRequestURI());
            return;
        }

        // Resolve database roles and permissions
        UserPermissionsDto permissions = userSecurityService.resolveEffectivePermissions(user);
        Set<GrantedAuthority> authorities = userSecurityService.buildAuthorities(user, permissions);
        Set<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());

        FirebaseUserDetails principal = new FirebaseUserDetails(user, roleNames, permissions, authorities);
        FirebaseAuthenticationToken authentication = new FirebaseAuthenticationToken(
                principal,
                tokenHolder,
                authorities
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        try {
            filterChain.doFilter(request, response);
        } finally {
            // Guarantee context is cleared between requests in thread pool
            SecurityContextHolder.clearContext();
        }
    }

    private boolean isRegistrationRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.endsWith(REGISTRATION_URI_SUFFIX) || uri.endsWith(SYNC_URI_SUFFIX);
    }

    private FirebaseUserDetails createUnregisteredPrincipal(FirebaseTokenHolder tokenHolder) {
        User tempUser = User.builder()
                .firebaseUid(tokenHolder.getUid())
                .email(tokenHolder.getEmail())
                .isActive(false)
                .build();
        return new FirebaseUserDetails(
                tempUser,
                Collections.emptySet(),
                new UserPermissionsDto(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_UNREGISTERED"))
        );
    }

    private void sendJsonError(
            HttpServletResponse response,
            int status,
            String error,
            String message,
            String path
    ) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);
        body.put("path", path);

        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
