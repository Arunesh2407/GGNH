export type AppointmentStatus =
  | "pending"
  | "booked"
  | "confirmed"
  | "completed"
  | "cancelled";

export type Appointment = {
  id: string;
  name: string;
  email: string;
  phone: string;
  doctor: string;
  message: string;
  appointmentDate?: string;
  timeSlot?: string;
  status: AppointmentStatus;
  createdAt: string;
  completedAt?: string;
  updatedAt?: string;
};

export type AppointmentInput = {
  name: string;
  phone: string;
  email?: string;
  doctor?: string;
  message?: string;
  appointmentDate?: string;
  timeSlot?: string;
};

export type BackendAppointmentDto = {
  id: string;
  name?: string;
  patientName?: string;
  email?: string | null;
  patientEmail?: string | null;
  phone?: string;
  patientPhone?: string;
  doctor?: string | null;
  doctorName?: string | null;
  department?: string | null;
  message?: string | null;
  appointmentDate?: string | null;
  timeSlot?: string | null;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  updatedAt?: string | null;
};

export type BackendPagedAppointmentResponse = {
  content: BackendAppointmentDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
};

export type PagedAppointments = {
  content: Appointment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
};
