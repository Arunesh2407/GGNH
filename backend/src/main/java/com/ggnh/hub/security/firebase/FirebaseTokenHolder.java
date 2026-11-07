package com.ggnh.hub.security.firebase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FirebaseTokenHolder {

    private String uid;
    private String email;
    private boolean emailVerified;
    private String name;
    private String picture;
    private String issuer;

    @Builder.Default
    private Map<String, Object> claims = Collections.emptyMap();
}
