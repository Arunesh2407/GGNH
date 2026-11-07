export type UserAccessRole =
  | "owner"
  | "editor"
  | "viewer"
  | "store-manager"
  | "department-head"
  | "auditor";

export type UserPermissions = {
  manageAttendance: boolean;
  manageAppointments: boolean;
  manageUsers: boolean;
  manageInventory: boolean;
  manageInventoryReports: boolean;
};

export type UserAccessRecord = {
  id: string;
  email: string;
  role: UserAccessRole;
  isActive: boolean;
  permissions: UserPermissions;
  updatedBy?: string;
  updatedAt?: string;
};

export type BackendUserProfile = {
  id: string;
  firebaseUid?: string | null;
  email: string;
  active?: boolean;
  isActive?: boolean;
  roles?: string[];
  permissions?: UserPermissions;
};

