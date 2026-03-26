import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Client, Databases } from "node-appwrite";

initializeApp();

type DeleteUserPayload = {
  accessRecordId?: string;
  email?: string;
  deletedBy?: string;
};

const requiredEnv = {
  appwriteEndpoint: process.env.APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  appwriteDatabaseId: process.env.APPWRITE_DATABASE_ID,
  appwriteUserAccessCollectionId:
    process.env.APPWRITE_USER_ACCESS_COLLECTION_ID,
};

const authorizedDeleteEmails = new Set(
  (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const ensureConfig = () => {
  for (const [key, value] of Object.entries(requiredEnv)) {
    if (!value) {
      throw new HttpsError("failed-precondition", `Missing env: ${key}`);
    }
  }
};

const getAppwriteDatabases = () => {
  ensureConfig();

  const client = new Client()
    .setEndpoint(requiredEnv.appwriteEndpoint as string)
    .setProject(requiredEnv.appwriteProjectId as string)
    .setKey(requiredEnv.appwriteApiKey as string);

  return new Databases(client);
};

const deleteFirestoreUserDocs = async (uid: string) => {
  const firestore = getFirestore();

  const possibleUserDocPaths = [
    ["users", uid],
    ["userProfiles", uid],
    ["staffProfiles", uid],
    ["accessControlUsers", uid],
  ] as const;

  await Promise.all(
    possibleUserDocPaths.map(async ([collectionName, docId]) => {
      await firestore.collection(collectionName).doc(docId).delete();
    }),
  );
};

export const deleteUserAccessAccount = onCall(async (request) => {
  const caller = request.auth;

  if (!caller?.token?.email) {
    throw new HttpsError("unauthenticated", "Sign in again to continue.");
  }

  const callerEmail = caller.token.email.trim().toLowerCase();

  if (
    authorizedDeleteEmails.size > 0 &&
    !authorizedDeleteEmails.has(callerEmail)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only super admins can delete user accounts.",
    );
  }

  const data = request.data as DeleteUserPayload;
  const email = data.email?.trim().toLowerCase();
  const accessRecordId = data.accessRecordId?.trim();

  if (!email || !accessRecordId) {
    throw new HttpsError(
      "invalid-argument",
      "accessRecordId and email are required.",
    );
  }

  const firebaseAuth = getAuth();
  let targetUid = "";

  try {
    const user = await firebaseAuth.getUserByEmail(email);
    targetUid = user.uid;
  } catch {
    throw new HttpsError(
      "not-found",
      "Target user not found in Firebase Auth.",
    );
  }

  try {
    await deleteFirestoreUserDocs(targetUid);
    await firebaseAuth.deleteUser(targetUid);

    const databases = getAppwriteDatabases();
    await databases.deleteDocument(
      requiredEnv.appwriteDatabaseId as string,
      requiredEnv.appwriteUserAccessCollectionId as string,
      accessRecordId,
    );

    return {
      ok: true,
      message: `Deleted ${email} by ${data.deletedBy ?? callerEmail}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete user account across all systems.";

    throw new HttpsError("internal", message);
  }
});
