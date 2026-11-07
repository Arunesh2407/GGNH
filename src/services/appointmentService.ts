import { apiClient } from "@/services/apiClient";
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  BackendAppointmentDto,
  BackendPagedAppointmentResponse,
  PagedAppointments,
} from "@/types/appointment";

export type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  BackendAppointmentDto,
  BackendPagedAppointmentResponse,
  PagedAppointments,
};

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const toAppointment = (dto: BackendAppointmentDto): Appointment => {
  const normalizedStatus = (dto.status || "").toLowerCase();
  const status: AppointmentStatus =
    normalizedStatus === "completed"
      ? "completed"
      : normalizedStatus === "cancelled"
      ? "cancelled"
      : normalizedStatus === "confirmed"
      ? "confirmed"
      : normalizedStatus === "pending"
      ? "pending"
      : "booked";

  return {
    id: dto.id,
    name: dto.name || dto.patientName || "",
    email: dto.email || dto.patientEmail || "",
    phone: dto.phone || dto.patientPhone || "",
    doctor: dto.doctor || dto.doctorName || "",
    message: dto.message || "",
    appointmentDate: dto.appointmentDate || undefined,
    timeSlot: dto.timeSlot || undefined,
    status,
    createdAt: dto.createdAt,
    completedAt: dto.completedAt || undefined,
    updatedAt: dto.updatedAt || undefined,
  };
};

export const appointmentService = {
  /**
   * Retrieves a single paginated page of appointments with optional search and date filters.
   * Sends Firebase ID token through apiClient.
   */
  async getPagedAppointments(options?: {
    page?: number;
    size?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PagedAppointments> {
    const params: Record<string, string | number | undefined> = {};
    if (options?.page !== undefined) params.page = options.page;
    if (options?.size !== undefined) params.size = options.size;
    if (options?.status) params.status = options.status.toUpperCase();
    if (options?.search) params.search = options.search;
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const response = await apiClient.get<BackendPagedAppointmentResponse>(
      "/appointments",
      { params }
    );

    return {
      content: (response.content || []).map(toAppointment),
      page: response.page,
      size: response.size,
      totalElements: response.totalElements,
      totalPages: response.totalPages,
      last: response.last,
      first: response.first,
    };
  },

  /**
   * Retrieves all appointments by paging through the API until exhausted.
   * Ensures components expecting the complete list do not silently truncate at page 0.
   * Detects pagination loops, stagnant responses, and enforces an explicit safety ceiling.
   */
  async getAppointments(options?: {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Appointment[]> {
    const allAppointments: Appointment[] = [];
    let page = 0;
    const pageSize = 50;
    let isLast = false;
    const maxPages = 200; // safety ceiling (10,000 items)
    const seenPageIndices = new Set<number>();
    const seenAppointmentIds = new Set<string>();

    while (!isLast) {
      if (page >= maxPages) {
        throw new Error(
          `Safety limit exceeded while retrieving appointments: more than ${
            maxPages * pageSize
          } records found. Please use paginated views to browse historical records.`
        );
      }

      if (seenPageIndices.has(page)) {
        throw new Error(
          `Pagination cycle detected: duplicate page index ${page} encountered.`
        );
      }
      seenPageIndices.add(page);

      const response = await this.getPagedAppointments({
        page,
        size: pageSize,
        status: options?.status,
        search: options?.search,
        startDate: options?.startDate,
        endDate: options?.endDate,
      });

      if (
        typeof response.totalPages !== "number" ||
        typeof response.totalElements !== "number" ||
        response.totalPages < 0 ||
        response.totalElements < 0
      ) {
        throw new Error(
          `Invalid pagination metadata received from server at page ${page}.`
        );
      }

      if (!response.content || response.content.length === 0) {
        break;
      }

      let newItemsCount = 0;
      for (const item of response.content) {
        if (!seenAppointmentIds.has(item.id)) {
          seenAppointmentIds.add(item.id);
          allAppointments.push(item);
          newItemsCount++;
        }
      }

      if (newItemsCount === 0 && !response.last) {
        throw new Error(
          `Stagnant pagination detected at page ${page}: received 0 new records from server.`
        );
      }

      isLast = response.last || page >= response.totalPages - 1;
      page++;
    }

    return allAppointments;
  },

  /**
   * Retrieves appointments booked by the authenticated patient.
   */
  async getMyAppointments(): Promise<Appointment[]> {
    const response = await apiClient.get<BackendAppointmentDto[]>("/appointments/my");
    return (response || []).map(toAppointment);
  },

  /**
   * Retrieves a single appointment by UUID.
   */
  async getAppointmentById(id: string): Promise<Appointment> {
    const response = await apiClient.get<BackendAppointmentDto>(
      `/appointments/${id}`
    );
    return toAppointment(response);
  },

  /**
   * Submits a public appointment booking request with mandatory idempotency key.
   * Supports optional authenticated patient attachment via Bearer token.
   */
  async addAppointment(
    input: AppointmentInput,
    idempotencyKey?: string,
    authenticated: boolean = false
  ): Promise<Appointment> {
    const key = idempotencyKey || generateUuid();

    const payload = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() ? input.email.trim().toLowerCase() : undefined,
      doctor: input.doctor?.trim() || undefined,
      message: input.message?.trim() || undefined,
      appointmentDate: input.appointmentDate || undefined,
      timeSlot: input.timeSlot || undefined,
    };

    const response = await apiClient.post<BackendAppointmentDto>(
      "/appointments",
      payload,
      {
        skipAuth: !authenticated,
        headers: {
          "Idempotency-Key": key,
        },
      }
    );

    return toAppointment(response);
  },

  /**
   * Confirms a pending/booked appointment.
   */
  async confirmAppointment(id: string): Promise<Appointment> {
    const response = await apiClient.patch<BackendAppointmentDto>(
      `/appointments/${id}/confirm`
    );
    return toAppointment(response);
  },

  /**
   * Cancels an appointment.
   */
  async cancelAppointment(id: string): Promise<Appointment> {
    const response = await apiClient.patch<BackendAppointmentDto>(
      `/appointments/${id}/cancel`
    );
    return toAppointment(response);
  },

  /**
   * Completes an appointment by UUID.
   * Returns the updated appointment domain object.
   */
  async completeAppointment(id: string): Promise<Appointment> {
    const response = await apiClient.patch<BackendAppointmentDto>(
      `/appointments/${id}/complete`
    );
    return toAppointment(response);
  },

  /**
   * Preserves backward compatibility with existing staff views:
   * Marks appointment completed and returns the refreshed complete appointment list.
   */
  async markCompleted(id: string): Promise<Appointment[]> {
    await this.completeAppointment(id);
    return this.getAppointments();
  },
};
