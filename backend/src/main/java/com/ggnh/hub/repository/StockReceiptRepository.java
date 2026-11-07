package com.ggnh.hub.repository;

import com.ggnh.hub.entity.StockReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StockReceiptRepository extends JpaRepository<StockReceipt, UUID> {
    Optional<StockReceipt> findByReceiptNumber(String receiptNumber);
    boolean existsByReceiptNumber(String receiptNumber);
    List<StockReceipt> findBySupplierId(UUID supplierId);
    List<StockReceipt> findByReceivedDateBetween(LocalDate startDate, LocalDate endDate);
}

