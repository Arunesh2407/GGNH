import { ID, Query } from "appwrite";
import {
  appwriteConfig,
  appwriteDatabases,
  isAppwriteConfigured,
} from "@/lib/appwrite";
import type {
  AttendanceStatus,
  StaffMember,
} from "@/context/AttendanceContext";

export type AttendanceByDate = Record<string, Record<string, AttendanceStatus>>;

type AttendanceDocument = {
  $id: string;
  date: string;
  staffId: string;
  status: AttendanceStatus;
};

type StaffDocument = {
  $id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
};

const assertConfigured = () => {
  if (!isAppwriteConfigured) {
    throw new Error(
      "Appwrite is not configured. Add Appwrite env variables in your .env file.",
    );
  }
};

const toAttendanceMap = (documents: AttendanceDocument[]): AttendanceByDate => {
  const attendanceByDate: AttendanceByDate = {};

  documents.forEach((document) => {
    if (!attendanceByDate[document.date]) {
      attendanceByDate[document.date] = {};
    }
    attendanceByDate[document.date][document.staffId] = document.status;
  });

  return attendanceByDate;
};

export const attendanceService = {
  async getStaff() {
    assertConfigured();

    const response = await appwriteDatabases.listDocuments<StaffDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.staffCollectionId,
      [Query.limit(5000)],
    );

    return response.documents.map<StaffMember>((document) => ({
      id: document.$id,
      name: document.name,
      role: document.role,
      phone: document.phone ?? "",
      email: document.email ?? "",
    }));
  },

  async addStaff(member: Omit<StaffMember, "id">) {
    assertConfigured();

    const response = await appwriteDatabases.createDocument<StaffDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.staffCollectionId,
      ID.unique(),
      {
        name: member.name,
        role: member.role,
        phone: member.phone,
        email: member.email,
      },
    );

    return {
      id: response.$id,
      name: response.name,
      role: response.role,
      phone: response.phone ?? "",
      email: response.email ?? "",
    } as StaffMember;
  },

  async updateStaff(id: string, member: Omit<StaffMember, "id">) {
    assertConfigured();

    await appwriteDatabases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.staffCollectionId,
      id,
      {
        name: member.name,
        role: member.role,
        phone: member.phone,
        email: member.email,
      },
    );
  },

  async removeStaff(id: string) {
    assertConfigured();

    await appwriteDatabases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.staffCollectionId,
      id,
    );

    const attendanceResponse =
      await appwriteDatabases.listDocuments<AttendanceDocument>(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        [Query.equal("staffId", id), Query.limit(5000)],
      );

    await Promise.all(
      attendanceResponse.documents.map((document) =>
        appwriteDatabases.deleteDocument(
          appwriteConfig.databaseId,
          appwriteConfig.attendanceCollectionId,
          document.$id,
        ),
      ),
    );
  },

  async getAttendanceByDate() {
    assertConfigured();

    const response = await appwriteDatabases.listDocuments<AttendanceDocument>(
      appwriteConfig.databaseId,
      appwriteConfig.attendanceCollectionId,
      [Query.limit(5000)],
    );

    return toAttendanceMap(response.documents);
  },

  async markAttendance(
    date: string,
    staffId: string,
    status: AttendanceStatus,
  ) {
    assertConfigured();

    const attendanceDocId = `${date}_${staffId}`;

    try {
      await appwriteDatabases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        attendanceDocId,
        {
          date,
          staffId,
          status,
        },
      );
      return;
    } catch {
      await appwriteDatabases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        attendanceDocId,
        {
          date,
          staffId,
          status,
        },
      );
    }
  },

  async clearAttendance(date: string, staffId: string) {
    assertConfigured();

    const attendanceDocId = `${date}_${staffId}`;

    try {
      await appwriteDatabases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.attendanceCollectionId,
        attendanceDocId,
      );
    } catch {
      // Nothing to clear if record does not exist.
    }
  },
};
