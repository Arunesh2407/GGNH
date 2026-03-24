import { ID, Query } from "appwrite";
import {
  appwriteConfig,
  appwriteDatabases,
  isAppointmentStorageConfigured,
} from "@/lib/appwrite";

export type AppointmentStatus = "booked" | "completed";

export type Appointment = {
  id: string;
  name: string;
  email: string;
  phone: string;
  doctor: string;
  message: string;
  status: AppointmentStatus;
  createdAt: string;
  completedAt?: string;
};

type AppointmentInput = Omit<
  Appointment,
  "id" | "status" | "createdAt" | "completedAt"
>;

type AppointmentDocument = {
  $id: string;
  $createdAt: string;
  name: string;
  email: string;
  phone: string;
  doctor: string;
  message: string;
  status: AppointmentStatus;
  completedAt?: string;
};

const assertConfigured = () => {
  if (!isAppointmentStorageConfigured) {
    throw new Error(
      "Appwrite appointment collection is not configured. Set VITE_APPWRITE_APPOINTMENT_COLLECTION_ID.",
    );
  }
};

const toAppointment = (document: AppointmentDocument): Appointment => ({
  id: document.$id,
  name: document.name,
  email: document.email,
  phone: document.phone,
  doctor: document.doctor,
  message: document.message,
  status: document.status,
  createdAt: document.$createdAt,
  completedAt: document.completedAt,
});

export const appointmentService = {
  async getAppointments() {
    assertConfigured();

    const response = await appwriteDatabases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.appointmentCollectionId,
      [Query.orderDesc("$createdAt"), Query.limit(5000)],
    );

    return response.documents.map((document) =>
      toAppointment(document as unknown as AppointmentDocument),
    );
  },

  async addAppointment(input: AppointmentInput) {
    assertConfigured();

    const response = await appwriteDatabases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.appointmentCollectionId,
      ID.unique(),
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        doctor: input.doctor,
        message: input.message,
        status: "booked",
      },
    );

    return toAppointment(response as unknown as AppointmentDocument);
  },

  async markCompleted(id: string) {
    assertConfigured();

    await appwriteDatabases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.appointmentCollectionId,
      id,
      {
        status: "completed",
        completedAt: new Date().toISOString(),
      },
    );

    return this.getAppointments();
  },
};
