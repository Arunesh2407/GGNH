import { apiClient } from "@/services/apiClient";
import type {
  AttendanceByDate,
  AttendanceRecord,
  AttendanceStatus,
  BackendStaff,
  StaffMember,
} from "@/types/attendance";

export type {
  AttendanceByDate,
  AttendanceRecord,
  AttendanceStatus,
  BackendStaff,
  StaffMember,
};

export const attendanceService = {
  async getStaff(): Promise<StaffMember[]> {
    const staffList = await apiClient.get<BackendStaff[]>("/staff");
    return staffList.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone ?? "",
      email: s.email ?? "",
      designation: s.designation,
      department: s.department,
      employmentStatus: s.employmentStatus,
      joiningDate: s.joiningDate,
      userId: s.userId,
      isActive: s.isActive ?? true,
    }));
  },

  async addStaff(member: Partial<StaffMember>): Promise<StaffMember> {
    const payload: Record<string, unknown> = {
      name: member.name?.trim() || "",
      role: member.role?.trim() || "",
      phone: member.phone?.trim() || "",
      email: member.email?.trim() || "",
    };
    if (member.designation?.trim()) payload.designation = member.designation.trim();
    if (member.department?.trim()) payload.department = member.department.trim();
    if (member.employmentStatus) payload.employmentStatus = member.employmentStatus;
    if (member.joiningDate) payload.joiningDate = member.joiningDate;
    if (member.userId) payload.userId = member.userId;

    const created = await apiClient.post<BackendStaff>("/staff", payload);

    return {
      id: created.id,
      name: created.name,
      role: created.role,
      phone: created.phone ?? "",
      email: created.email ?? "",
      designation: created.designation,
      department: created.department,
      employmentStatus: created.employmentStatus,
      joiningDate: created.joiningDate,
      userId: created.userId,
      isActive: created.isActive ?? true,
    };
  },

  async updateStaff(id: string, member: Partial<StaffMember>): Promise<StaffMember> {
    const payload: Record<string, unknown> = {
      name: member.name?.trim() || "",
      role: member.role?.trim() || "",
      phone: member.phone?.trim() || "",
      email: member.email?.trim() || "",
    };
    if (member.designation?.trim()) payload.designation = member.designation.trim();
    if (member.department?.trim()) payload.department = member.department.trim();
    if (member.employmentStatus) payload.employmentStatus = member.employmentStatus;
    if (member.joiningDate) payload.joiningDate = member.joiningDate;
    if (member.userId) payload.userId = member.userId;

    const updated = await apiClient.put<BackendStaff>(`/staff/${id}`, payload);

    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      phone: updated.phone ?? "",
      email: updated.email ?? "",
      designation: updated.designation,
      department: updated.department,
      employmentStatus: updated.employmentStatus,
      joiningDate: updated.joiningDate,
      userId: updated.userId,
      isActive: updated.isActive ?? true,
    };
  },

  async removeStaff(id: string): Promise<void> {
    await apiClient.delete(`/staff/${id}`);
  },

  async getAttendanceByDate(date?: string): Promise<AttendanceByDate> {
    const path = date ? `/attendance?date=${encodeURIComponent(date)}` : "/attendance";
    const result = await apiClient.get<AttendanceByDate>(path);
    return result || {};
  },

  async getDetailedRecords(options?: {
    date?: string;
    staffId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AttendanceRecord[]> {
    const params: Record<string, string> = {};
    if (options?.date) params.date = options.date;
    if (options?.staffId) params.staffId = options.staffId;
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const records = await apiClient.get<AttendanceRecord[]>("/attendance/records", {
      params,
    });
    return records || [];
  },

  async checkIn(staffId?: string): Promise<AttendanceRecord> {
    const params = staffId ? { staffId } : undefined;
    return await apiClient.post<AttendanceRecord>("/attendance/check-in", null, {
      params,
    });
  },

  async checkOut(staffId?: string): Promise<AttendanceRecord> {
    const params = staffId ? { staffId } : undefined;
    return await apiClient.post<AttendanceRecord>("/attendance/check-out", null, {
      params,
    });
  },

  async markAttendance(
    date: string,
    staffId: string,
    status: AttendanceStatus,
    notes?: string
  ): Promise<AttendanceRecord> {
    const payload: { date: string; staffId: string; status: AttendanceStatus; notes?: string } = {
      date,
      staffId,
      status,
    };
    if (notes && notes.trim()) {
      payload.notes = notes.trim();
    }
    return await apiClient.post<AttendanceRecord>("/attendance/mark", payload);
  },

  async clearAttendance(date: string, staffId: string): Promise<void> {
    await apiClient.delete(
      `/attendance?date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(staffId)}`
    );
  },
};
