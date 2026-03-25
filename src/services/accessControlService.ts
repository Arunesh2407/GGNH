import { ID, Permission, Query, Role, type Models } from "appwrite";
import {
  appwriteConfig,
  appwriteDatabases,
  isUserAccessStorageConfigured,
} from "@/lib/appwrite";

export type UserAccessRole = "owner" | "editor" | "viewer";

export type UserPermissions = {
  manageAttendance: boolean;
  manageAppointments: boolean;
  manageUsers: boolean;
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

type UserAccessDocument = Models.Document & {
  email: string;
  role: string;
  isActive: boolean;
  manageAttendance?: boolean;
  manageAppointments?: boolean;
  manageUsers?: boolean;
  updatedBy?: string;
  updatedAt?: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const defaultDocumentPermissions = [
  Permission.read(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

const toSafeRole = (role: string): UserAccessRole => {
  const normalized = role.trim().toLowerCase();

  if (normalized === "owner") {
    return "owner";
  }

  if (normalized === "editor") {
    return "editor";
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
    };
  }

  if (role === "editor") {
    return {
      manageAttendance: true,
      manageAppointments: true,
      manageUsers: false,
    };
  }

  return {
    manageAttendance: false,
    manageAppointments: false,
    manageUsers: false,
  };
};

const toRecord = (document: UserAccessDocument): UserAccessRecord => ({
  ...(() => {
    const role = toSafeRole(document.role);
    const defaults = getDefaultPermissionsForRole(role);

    return {
      role,
      permissions: {
        manageAttendance:
          document.manageAttendance ?? defaults.manageAttendance,
        manageAppointments:
          document.manageAppointments ?? defaults.manageAppointments,
        manageUsers: document.manageUsers ?? defaults.manageUsers,
      },
    };
  })(),
  id: document.$id,
  email: document.email,
  isActive: Boolean(document.isActive),
  updatedBy: document.updatedBy,
  updatedAt: document.updatedAt ?? document.$updatedAt,
});

const assertConfigured = () => {
  if (!isUserAccessStorageConfigured) {
    throw new Error(
      "User access storage is not configured. Add VITE_APPWRITE_USER_ACCESS_COLLECTION_ID in your .env file.",
    );
  }
};

export const accessControlService = {
  isConfigured: isUserAccessStorageConfigured,

  async listUsers() {
    assertConfigured();

    const response = await appwriteDatabases.listDocuments<UserAccessDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.userAccessCollectionId,
      [Query.limit(5000)],
    );

    return response.documents
      .map(toRecord)
      .sort((first, second) => first.email.localeCompare(second.email));
  },

  async getUserByEmail(email: string) {
    assertConfigured();

    const response = await appwriteDatabases.listDocuments<UserAccessDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.userAccessCollectionId,
      [Query.equal("email", normalizeEmail(email)), Query.limit(1)],
    );

    const [first] = response.documents;
    return first ? toRecord(first) : null;
  },

  async upsertUser(input: {
    email: string;
    role: UserAccessRole;
    isActive: boolean;
    updatedBy: string;
    permissions?: UserPermissions;
  }) {
    assertConfigured();

    const normalizedEmail = normalizeEmail(input.email);
    const existing = await accessControlService.getUserByEmail(normalizedEmail);
    const payload = {
      email: normalizedEmail,
      role: input.role,
      isActive: input.isActive,
      ...(input.permissions
        ? {
            manageAttendance: input.permissions.manageAttendance,
            manageAppointments: input.permissions.manageAppointments,
            manageUsers: input.permissions.manageUsers,
          }
        : {}),
      updatedBy: input.updatedBy,
    };

    if (existing) {
      const updated =
        await appwriteDatabases.updateDocument<UserAccessDocument>(
          appwriteConfig.databaseId,
          appwriteConfig.userAccessCollectionId,
          existing.id,
          payload,
          defaultDocumentPermissions,
        );

      return toRecord(updated);
    }

    const created = await appwriteDatabases.createDocument<UserAccessDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.userAccessCollectionId,
      ID.unique(),
      payload,
      defaultDocumentPermissions,
    );

    return toRecord(created);
  },

  async removeUserById(id: string) {
    assertConfigured();

    await appwriteDatabases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userAccessCollectionId,
      id,
    );
  },
};
