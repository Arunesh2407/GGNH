package com.ggnh.hub.repository;

import com.ggnh.hub.entity.InventoryCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, UUID> {
    Optional<InventoryCategory> findByCode(String code);
    Optional<InventoryCategory> findByName(String name);
    boolean existsByCode(String code);
    boolean existsByName(String name);
    List<InventoryCategory> findByIsActiveTrue();
}

