import { ID, Permission, Query, Role, type Models } from "appwrite";
import { httpsCallable } from "firebase/functions";
import {
  appwriteConfig,
  appwriteDatabases,
  isUserAccessStorageConfigured,
} from "@/lib/appwrite";
import { firebaseFunctions, isFirebaseConfigured } from "@/lib/firebase";

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

type UserAccessDocument = Models.Document & {
  email: string;
  role: string;
  isActive: boolean;
  manageAttendance?: boolean;
  manageAppointments?: boolean;
  manageUsers?: boolean;
  manageInventory?: boolean;
  manageInventoryReports?: boolean;
  updatedBy?: string;
  updatedAt?: string;
};

type DeleteUserAccountPayload = {
  accessRecordId: string;
  email: string;
  deletedBy: string;
};

type DeleteUserAccountResult = {
  ok: boolean;
  message?: string;
};

const deleteUserFunctionName =
  import.meta.env.VITE_FIREBASE_DELETE_USER_FUNCTION_NAME ||
  "deleteUserAccessAccount";

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
      manageInventory: true,
      manageInventoryReports: true,
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
        manageInventory: document.manageInventory ?? defaults.manageInventory,
        manageInventoryReports:
          document.manageInventoryReports ?? defaults.manageInventoryReports,
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
            manageInventory: input.permissions.manageInventory,
            manageInventoryReports: input.permissions.manageInventoryReports,
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

  async removeUserEverywhere(input: {
    accessRecordId: string;
    email: string;
    deletedBy: string;
  }) {
    assertConfigured();

    if (!isFirebaseConfigured || !firebaseFunctions) {
      throw new Error(
        "Firebase Functions is not configured. Configure it to delete users from Firebase and Firestore.",
      );
    }

    const callDeleteUser = httpsCallable<
      DeleteUserAccountPayload,
      DeleteUserAccountResult
    >(firebaseFunctions, deleteUserFunctionName);

    const response = await callDeleteUser({
      accessRecordId: input.accessRecordId,
      email: normalizeEmail(input.email),
      deletedBy: normalizeEmail(input.deletedBy),
    });

    if (!response.data?.ok) {
      throw new Error(
        response.data?.message ||
          "Unable to delete user from Firebase and Appwrite.",
      );
    }
  },
};
