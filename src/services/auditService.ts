import { apiClient } from "@/services/apiClient";

export interface AuditLogItem {
  id: string;
  actingUser: string;
  action: string;
  module: string;
  recordId?: string;
  details?: string;
  createdAt: string;
}

export const auditService = {
  async getAuditLogs(params?: { module?: string; limit?: number }): Promise<AuditLogItem[]> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.module) queryParams.module = params.module;
    if (params?.limit) queryParams.limit = params.limit;

    return apiClient.get<AuditLogItem[]>("/audit-logs", {
      params: queryParams,
    });
  },
};

