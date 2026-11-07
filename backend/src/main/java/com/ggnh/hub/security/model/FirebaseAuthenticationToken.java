package com.ggnh.hub.security.model;

import com.ggnh.hub.security.firebase.FirebaseTokenHolder;
import lombok.Getter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

@Getter
public class FirebaseAuthenticationToken extends AbstractAuthenticationToken {

    private final FirebaseUserDetails principal;
    private final FirebaseTokenHolder credentials;

    public FirebaseAuthenticationToken(
            FirebaseUserDetails principal,
            FirebaseTokenHolder credentials,
            Collection<? extends GrantedAuthority> authorities
    ) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
        setAuthenticated(true);
    }

    @Override
    public FirebaseTokenHolder getCredentials() {
        return credentials;
    }

    @Override
    public FirebaseUserDetails getPrincipal() {
        return principal;
    }
}
