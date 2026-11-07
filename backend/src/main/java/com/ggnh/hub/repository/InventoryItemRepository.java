package com.ggnh.hub.repository;

import com.ggnh.hub.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, UUID> {
    Optional<InventoryItem> findBySku(String sku);
    boolean existsBySku(String sku);
    List<InventoryItem> findByCategoryId(UUID categoryId);
    List<InventoryItem> findByIsActiveTrue();
}

