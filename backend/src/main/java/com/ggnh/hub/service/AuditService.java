package com.ggnh.hub.service;

import com.ggnh.hub.dto.AuditLogResponse;
import com.ggnh.hub.entity.AuditLog;
import com.ggnh.hub.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String actingUser, String module, String action, String recordId, String details) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .actingUser(actingUser != null && !actingUser.isBlank() ? actingUser.trim() : "system")
                    .module(module != null ? module.trim().toUpperCase() : "GENERAL")
                    .action(action != null ? action.trim().toUpperCase() : "UNKNOWN")
                    .recordId(recordId != null ? recordId.trim() : null)
                    .details(details != null ? details.trim() : null)
                    .createdAt(OffsetDateTime.now())
                    .build();
            auditLogRepository.save(auditLog);
            log.info("Audit: [{}] {} on {} (ID: {}) by {}", module, action, recordId, actingUser);
        } catch (Exception ex) {
            log.error("Failed to persist audit log: {} on {}", action, module, ex);
        }
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> getRecentAuditLogs(int limit) {
        int boundedLimit = Math.min(100, Math.max(1, limit));
        Page<AuditLog> page = auditLogRepository.findAllByOrderByCreatedAtDesc(
                PageRequest.of(0, boundedLimit, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return page.getContent().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByModule(String module, int page, int size) {
        int boundedPage = Math.max(0, page);
        int boundedSize = Math.min(100, Math.max(1, size));
        return auditLogRepository.findByModuleOrderByCreatedAtDesc(
                module.trim().toUpperCase(),
                PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).map(this::toResponse);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .actingUser(log.getActingUser())
                .action(log.getAction())
                .module(log.getModule())
                .recordId(log.getRecordId())
                .details(log.getDetails())
                .createdAt(log.getCreatedAt())
                .build();
    }
}

