import { apiClient } from "@/services/apiClient";
import type { BackendStaff, StaffMember } from "@/types/attendance";

export interface StaffSearchParams {
  search?: string;
  role?: string;
  department?: string;
  isActive?: boolean;
}

export const staffService = {
  async getAllStaff(params?: StaffSearchParams): Promise<StaffMember[]> {
    const queryParams: Record<string, string | boolean | undefined> = {};
    if (params?.search) queryParams.search = params.search.trim();
    if (params?.role) queryParams.role = params.role.trim();
    if (params?.department) queryParams.department = params.department.trim();
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive;

    const staffList = await apiClient.get<BackendStaff[]>("/staff", {
      params: queryParams,
    });

    return staffList.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone ?? "",
      email: s.email ?? "",
      designation: s.designation ?? "",
      department: s.department ?? "",
      employmentStatus: s.employmentStatus ?? "FULL_TIME",
      joiningDate: s.joiningDate ?? "",
      userId: s.userId ?? "",
      isActive: s.isActive ?? true,
    }));
  },

  async getStaffById(id: string): Promise<StaffMember> {
    const s = await apiClient.get<BackendStaff>(`/staff/${id}`);
    return {
      id: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone ?? "",
      email: s.email ?? "",
      designation: s.designation ?? "",
      department: s.department ?? "",
      employmentStatus: s.employmentStatus ?? "FULL_TIME",
      joiningDate: s.joiningDate ?? "",
      userId: s.userId ?? "",
      isActive: s.isActive ?? true,
    };
  },

  async createStaff(member: {
    name: string;
    role: string;
    phone?: string;
    email?: string;
    designation?: string;
    department?: string;
    employmentStatus?: string;
    joiningDate?: string;
  }): Promise<StaffMember> {
    const created = await apiClient.post<BackendStaff>("/staff", {
      name: member.name.trim(),
      role: member.role.trim(),
      phone: member.phone?.trim() || "",
      email: member.email?.trim() || "",
      designation: member.designation?.trim() || "",
      department: member.department?.trim() || "",
      employmentStatus: member.employmentStatus || "FULL_TIME",
      joiningDate: member.joiningDate || null,
      isActive: true,
    });

    return {
      id: created.id,
      name: created.name,
      role: created.role,
      phone: created.phone ?? "",
      email: created.email ?? "",
      designation: created.designation ?? "",
      department: created.department ?? "",
      employmentStatus: created.employmentStatus ?? "FULL_TIME",
      joiningDate: created.joiningDate ?? "",
      userId: created.userId ?? "",
      isActive: created.isActive ?? true,
    };
  },

  async updateStaff(
    id: string,
    member: {
      name: string;
      role: string;
      phone?: string;
      email?: string;
      designation?: string;
      department?: string;
      employmentStatus?: string;
      joiningDate?: string;
      isActive?: boolean;
    }
  ): Promise<StaffMember> {
    const updated = await apiClient.put<BackendStaff>(`/staff/${id}`, {
      name: member.name.trim(),
      role: member.role.trim(),
      phone: member.phone?.trim() || "",
      email: member.email?.trim() || "",
      designation: member.designation?.trim() || "",
      department: member.department?.trim() || "",
      employmentStatus: member.employmentStatus || "FULL_TIME",
      joiningDate: member.joiningDate || null,
      isActive: member.isActive ?? true,
    });

    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      phone: updated.phone ?? "",
      email: updated.email ?? "",
      designation: updated.designation ?? "",
      department: updated.department ?? "",
      employmentStatus: updated.employmentStatus ?? "FULL_TIME",
      joiningDate: updated.joiningDate ?? "",
      userId: updated.userId ?? "",
      isActive: updated.isActive ?? true,
    };
  },

  async toggleStatus(id: string, active: boolean): Promise<StaffMember> {
    const updated = await apiClient.patch<BackendStaff>(`/staff/${id}/status`, {
      active,
    });
    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      phone: updated.phone ?? "",
      email: updated.email ?? "",
      designation: updated.designation ?? "",
      department: updated.department ?? "",
      employmentStatus: updated.employmentStatus ?? "FULL_TIME",
      joiningDate: updated.joiningDate ?? "",
      userId: updated.userId ?? "",
      isActive: updated.isActive ?? true,
    };
  },

  async deleteStaff(id: string): Promise<void> {
    await apiClient.delete(`/staff/${id}`);
  },
};

