package com.ggnh.hub.security.firebase;

/**
 * Interface for verifying Firebase ID tokens.
 * Decouples Spring Security filter from live Firebase Admin SDK for testing and local dev.
 */
public interface FirebaseTokenVerifier {

    /**
     * Verifies the given Firebase ID token string.
     *
     * @param idToken raw bearer token
     * @return decoded token holder containing UID, email, and claims
     * @throws Exception if token is invalid, expired, revoked, or verification fails
     */
    FirebaseTokenHolder verifyToken(String idToken) throws Exception;
}
