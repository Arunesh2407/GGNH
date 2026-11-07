import { apiClient } from "@/services/apiClient";
import {
  getDefaultPermissionsForRole,
  type UserAccessRecord,
  type UserAccessRole,
  type UserPermissions,
} from "@/services/accessControlService";
import type { BackendUserProfile } from "@/types/user";

export type { BackendUserProfile };

export const toUserAccessRecord = (profile: BackendUserProfile): UserAccessRecord => {
  const roles = profile.roles || [];
  const normalizedRoles = roles.map((r) => r.toLowerCase());
  
  let role: UserAccessRole = "viewer";
  if (normalizedRoles.includes("owner") || normalizedRoles.includes("admin")) {
    role = "owner";
  } else if (normalizedRoles.includes("editor")) {
    role = "editor";
  } else if (normalizedRoles.includes("store-manager") || normalizedRoles.includes("store_manager")) {
    role = "store-manager";
  } else if (normalizedRoles.includes("department-head") || normalizedRoles.includes("department_head")) {
    role = "department-head";
  } else if (normalizedRoles.includes("auditor")) {
    role = "auditor";
  }

  const active = profile.active ?? profile.isActive ?? false;

  return {
    id: profile.id,
    email: profile.email,
    role,
    isActive: active,
    permissions: profile.permissions || getDefaultPermissionsForRole(role),
  };
};

export const userService = {
  async listUsers(): Promise<UserAccessRecord[]> {
    const profiles = await apiClient.get<BackendUserProfile[]>("/users");
    return profiles.map(toUserAccessRecord).sort((a, b) => a.email.localeCompare(b.email));
  },

  async updateStatus(id: string, active: boolean): Promise<UserAccessRecord> {
    const profile = await apiClient.patch<BackendUserProfile>(`/users/${id}/status`, {
      active,
    });
    return toUserAccessRecord(profile);
  },

  async updateAccess(
    id: string,
    role: UserAccessRole,
    permissions: UserPermissions
  ): Promise<UserAccessRecord> {
    const profile = await apiClient.put<BackendUserProfile>(`/users/${id}/access`, {
      role,
      permissions,
    });
    return toUserAccessRecord(profile);
  },
};

