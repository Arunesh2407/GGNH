package com.ggnh.hub.repository;

import com.ggnh.hub.entity.InventoryLedger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryLedgerRepository extends JpaRepository<InventoryLedger, UUID> {
    List<InventoryLedger> findByItemIdOrderByCreatedAtDesc(UUID itemId);
    List<InventoryLedger> findBySourceTypeAndSourceId(String sourceType, UUID sourceId);
    Page<InventoryLedger> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<InventoryLedger> findTop20ByOrderByCreatedAtDesc();
}
