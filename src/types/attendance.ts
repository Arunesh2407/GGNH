export type AttendanceStatus =
  | "present"
  | "absent"
  | "leave"
  | "off"
  | "half-time"
  | "over-time";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  designation?: string;
  department?: string;
  employmentStatus?: string;
  joiningDate?: string;
  userId?: string;
  isActive?: boolean;
};

export type AttendanceRecord = {
  id: string;
  staffId: string;
  staffName?: string;
  staffRole?: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  correctedBy?: string;
  correctedAt?: string;
  recordedAt?: string;
};

export type AttendanceByDate = Record<string, Record<string, AttendanceStatus>>;

export type BackendStaff = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  designation?: string;
  department?: string;
  employmentStatus?: string;
  joiningDate?: string;
  userId?: string;
  isActive?: boolean;
};
