package com.ggnh.hub.security.firebase;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnMissingBean(value = FirebaseTokenVerifier.class, ignored = DefaultFirebaseTokenVerifier.class)
@RequiredArgsConstructor
public class DefaultFirebaseTokenVerifier implements FirebaseTokenVerifier {

    private final FirebaseInitializer firebaseInitializer;
    private final FirebaseProperties properties;

    @Override
    public FirebaseTokenHolder verifyToken(String idToken) throws Exception {
        if (!firebaseInitializer.isInitialized() || firebaseInitializer.getFirebaseApp() == null) {
            throw new IllegalStateException("Firebase Admin SDK is not initialized. Ensure valid credentials are provided.");
        }

        FirebaseAuth firebaseAuth = FirebaseAuth.getInstance(firebaseInitializer.getFirebaseApp());
        
        // Respect configurable check-revoked setting
        FirebaseToken decodedToken;
        if (properties.isCheckRevoked()) {
            decodedToken = firebaseAuth.verifyIdToken(idToken, true);
        } else {
            decodedToken = firebaseAuth.verifyIdToken(idToken);
        }

        return FirebaseTokenHolder.builder()
                .uid(decodedToken.getUid())
                .email(decodedToken.getEmail())
                .emailVerified(decodedToken.isEmailVerified())
                .name(decodedToken.getName())
                .picture(decodedToken.getPicture())
                .issuer(decodedToken.getIssuer())
                .claims(decodedToken.getClaims())
                .build();
    }
}
