import { Client, Databases } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

export const appwriteConfig = {
  endpoint,
  projectId,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  staffCollectionId: import.meta.env.VITE_APPWRITE_STAFF_COLLECTION_ID,
  attendanceCollectionId: import.meta.env
    .VITE_APPWRITE_ATTENDANCE_COLLECTION_ID,
  appointmentCollectionId: import.meta.env
    .VITE_APPWRITE_APPOINTMENT_COLLECTION_ID,
  userAccessCollectionId: import.meta.env
    .VITE_APPWRITE_USER_ACCESS_COLLECTION_ID,
};

export const isAppwriteConfigured = Boolean(
  appwriteConfig.endpoint &&
  appwriteConfig.projectId &&
  appwriteConfig.databaseId &&
  appwriteConfig.staffCollectionId &&
  appwriteConfig.attendanceCollectionId,
);

export const isAppointmentStorageConfigured = Boolean(
  isAppwriteConfigured && appwriteConfig.appointmentCollectionId,
);

export const isUserAccessStorageConfigured = Boolean(
  isAppwriteConfigured && appwriteConfig.userAccessCollectionId,
);

const client = new Client();

if (isAppwriteConfigured) {
  client
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);
}

export const appwriteDatabases = new Databases(client);
