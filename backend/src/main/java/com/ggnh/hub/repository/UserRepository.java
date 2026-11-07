package com.ggnh.hub.repository;

import com.ggnh.hub.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);

    @EntityGraph(attributePaths = {"roles", "permissions"})
    Optional<User> findByEmailIgnoreCase(String email);

    @EntityGraph(attributePaths = {"roles", "permissions"})
    Optional<User> findByFirebaseUid(String firebaseUid);

    @Override
    @EntityGraph(attributePaths = {"roles", "permissions"})
    Optional<User> findById(UUID id);

    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByFirebaseUid(String firebaseUid);

    @Query("SELECT COUNT(u) FROM User u JOIN u.roles r WHERE LOWER(r.name) = 'owner' AND u.isActive = true")
    long countActiveOwners();
}

