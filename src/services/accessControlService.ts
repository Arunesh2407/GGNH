import { ID, Permission, Query, Role, type Models } from "appwrite";
import {
  appwriteConfig,
  appwriteDatabases,
  isUserAccessStorageConfigured,
} from "@/lib/appwrite";

export type UserAccessRole = "owner" | "editor" | "viewer";

export type UserAccessRecord = {
  id: string;
  email: string;
  role: UserAccessRole;
  isActive: boolean;
  updatedBy?: string;
  updatedAt?: string;
};

type UserAccessDocument = Models.Document & {
  email: string;
  role: string;
  isActive: boolean;
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

const toRecord = (document: UserAccessDocument): UserAccessRecord => ({
  id: document.$id,
  email: document.email,
  role: toSafeRole(document.role),
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
  }) {
    assertConfigured();

    const normalizedEmail = normalizeEmail(input.email);
    const existing = await accessControlService.getUserByEmail(normalizedEmail);
    const payload = {
      email: normalizedEmail,
      role: input.role,
      isActive: input.isActive,
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
