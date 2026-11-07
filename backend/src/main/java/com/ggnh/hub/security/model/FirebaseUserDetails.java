package com.ggnh.hub.security.model;

import com.ggnh.hub.dto.UserPermissionsDto;
import com.ggnh.hub.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

@Getter
public class FirebaseUserDetails implements UserDetails {

    private final UUID id;
    private final String firebaseUid;
    private final String email;
    private final boolean active;
    private final Set<String> roles;
    private final UserPermissionsDto permissions;
    private final Collection<? extends GrantedAuthority> authorities;
    private final User user;

    public FirebaseUserDetails(
            User user,
            Set<String> roles,
            UserPermissionsDto permissions,
            Collection<? extends GrantedAuthority> authorities
    ) {
        this.user = user;
        this.id = user.getId();
        this.firebaseUid = user.getFirebaseUid();
        this.email = user.getEmail();
        this.active = user.isActive();
        this.roles = roles;
        this.permissions = permissions;
        this.authorities = authorities;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return active;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
