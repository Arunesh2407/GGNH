package com.ggnh.hub.repository;

import com.ggnh.hub.entity.StockReceiptItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StockReceiptItemRepository extends JpaRepository<StockReceiptItem, UUID> {
    List<StockReceiptItem> findByReceiptId(UUID receiptId);
    List<StockReceiptItem> findByItemId(UUID itemId);
}

