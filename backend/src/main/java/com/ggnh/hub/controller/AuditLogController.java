package com.ggnh.hub.controller;

import com.ggnh.hub.dto.AuditLogResponse;
import com.ggnh.hub.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditService auditService;

    @GetMapping
    @PreAuthorize("hasRole('owner') or hasAuthority('PERM_MANAGE_USERS')")
    public ResponseEntity<List<AuditLogResponse>> getAuditLogs(
            @RequestParam(required = false) String module,
            @RequestParam(defaultValue = "50") int limit
    ) {
        if (module != null && !module.isBlank()) {
            return ResponseEntity.ok(auditService.getAuditLogsByModule(module, 0, limit).getContent());
        }
        return ResponseEntity.ok(auditService.getRecentAuditLogs(limit));
    }
}

