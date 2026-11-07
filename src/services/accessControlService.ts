import type {
  UserAccessRecord,
  UserAccessRole,
  UserPermissions,
} from "@/types/user";

export type { UserAccessRecord, UserAccessRole, UserPermissions };

export const toSafeRole = (role: string): UserAccessRole => {
  const normalized = role.trim().toLowerCase();

  if (normalized === "owner" || normalized === "admin") {
    return "owner";
  }

  if (normalized === "editor") {
    return "editor";
  }

  if (normalized === "store-manager" || normalized === "store_manager") {
    return "store-manager";
  }

  if (normalized === "department-head" || normalized === "department_head") {
    return "department-head";
  }

  if (normalized === "auditor") {
    return "auditor";
  }

  return "viewer";
};

export const getDefaultPermissionsForRole = (
  role: UserAccessRole,
): UserPermissions => {
  if (role === "owner") {
    return {
      manageAttendance: true,
      manageAppointments: true,
      manageUsers: true,
      manageInventory: true,
      manageInventoryReports: true,
    };
  }

  if (role === "store-manager") {
    return {
      manageAttendance: false,
      manageAppointments: false,
      manageUsers: false,
      manageInventory: true,
      manageInventoryReports: true,
    };
  }

  if (role === "department-head") {
    return {
      manageAttendance: false,
      manageAppointments: false,
      manageUsers: false,
      manageInventory: false,
      manageInventoryReports: true,
    };
  }

  if (role === "auditor") {
    return {
      manageAttendance: false,
      manageAppointments: false,
      manageUsers: false,
      manageInventory: false,
      manageInventoryReports: true,
    };
  }

  if (role === "editor") {
    return {
      manageAttendance: true,
      manageAppointments: true,
      manageUsers: false,
      manageInventory: false,
      manageInventoryReports: false,
    };
  }

  return {
    manageAttendance: false,
    manageAppointments: false,
    manageUsers: false,
    manageInventory: false,
    manageInventoryReports: false,
  };
};
