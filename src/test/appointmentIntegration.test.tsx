import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  appointmentService,
  toAppointment,
  generateUuid,
  type BackendAppointmentDto,
  type BackendPagedAppointmentResponse,
} from "@/services/appointmentService";
import { apiClient, ApiError } from "@/services/apiClient";
import Contact from "@/pages/Contact";
import StaffAppointments from "@/pages/StaffAppointments";

// Mock toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock ScrollReveal to render children directly
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Frontend Appointment Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("A. appointmentService & DTO Mapping", () => {
    it("1. maps backend DTO to frontend domain entity with nullable fields normalized", () => {
      const backendDto: BackendAppointmentDto = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        patientName: "Ramesh Sharma",
        patientPhone: "+91 9876543210",
        patientEmail: null,
        doctorName: null,
        message: null,
        status: "BOOKED",
        createdAt: "2026-11-05T01:00:00Z",
        completedAt: null,
        updatedAt: null,
      };

      const entity = toAppointment(backendDto);

      expect(entity.id).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(entity.name).toBe("Ramesh Sharma");
      expect(entity.phone).toBe("+91 9876543210");
      expect(entity.email).toBe("");
      expect(entity.doctor).toBe("");
      expect(entity.message).toBe("");
      expect(entity.status).toBe("booked");
      expect(entity.completedAt).toBeUndefined();
    });

    it("2. addAppointment sends unauthenticated POST /appointments with Idempotency-Key", async () => {
      const mockPost = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
        id: "app-uuid-1",
        name: "Asha Devi",
        phone: "+91 9876543211",
        email: "asha@example.com",
        doctor: "Dr. Vikas Gupta",
        message: "Checkup",
        status: "BOOKED",
        createdAt: "2026-11-05T01:00:00Z",
      });

      const fixedKey = "99999999-9999-4999-8999-999999999999";
      const result = await appointmentService.addAppointment(
        {
          name: "  Asha Devi  ",
          phone: " +91 9876543211 ",
          email: "asha@example.com ",
          doctor: "Dr. Vikas Gupta",
          message: "Checkup",
        },
        fixedKey
      );

      expect(result.id).toBe("app-uuid-1");
      expect(result.name).toBe("Asha Devi");
      expect(result.status).toBe("booked");

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [endpoint, payload, options] = mockPost.mock.calls[0];
      expect(endpoint).toBe("/appointments");
      expect(payload).toEqual({
        name: "Asha Devi",
        phone: "+91 9876543211",
        email: "asha@example.com",
        doctor: "Dr. Vikas Gupta",
        message: "Checkup",
      });
      expect(options?.skipAuth).toBe(true);
      expect((options?.headers as Record<string, string>)["Idempotency-Key"]).toBe(fixedKey);
    });

    it("3. generateUuid produces a valid RFC 4122 v4 UUID", () => {
      const uuid = generateUuid();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("4. getPagedAppointments requests single page with query parameters", async () => {
      const mockGet = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        content: [
          {
            id: "uuid-p1",
            patientName: "Patient One",
            patientPhone: "9999900001",
            status: "BOOKED",
            createdAt: "2026-11-05T01:00:00Z",
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        last: true,
        first: true,
      } as BackendPagedAppointmentResponse);

      const paged = await appointmentService.getPagedAppointments({
        page: 0,
        size: 10,
        status: "booked",
      });

      expect(paged.content.length).toBe(1);
      expect(paged.content[0].name).toBe("Patient One");
      expect(paged.totalElements).toBe(1);
      expect(paged.totalPages).toBe(1);
      expect(paged.last).toBe(true);

      expect(mockGet).toHaveBeenCalledWith("/appointments", {
        params: { page: 0, size: 10, status: "BOOKED" },
      });
    });

    it("5. getAppointments loops through multiple pages so list is not truncated", async () => {
      const mockGet = vi.spyOn(apiClient, "get")
        .mockResolvedValueOnce({
          content: [
            { id: "app-1", patientName: "Patient 1", status: "BOOKED", createdAt: "2026-11-05T01:00:00Z" },
            { id: "app-2", patientName: "Patient 2", status: "BOOKED", createdAt: "2026-11-05T01:00:00Z" },
          ],
          page: 0,
          size: 2,
          totalElements: 3,
          totalPages: 2,
          last: false,
          first: true,
        } as BackendPagedAppointmentResponse)
        .mockResolvedValueOnce({
          content: [
            { id: "app-3", patientName: "Patient 3", status: "COMPLETED", createdAt: "2026-11-05T00:30:00Z" },
          ],
          page: 1,
          size: 2,
          totalElements: 3,
          totalPages: 2,
          last: true,
          first: false,
        } as BackendPagedAppointmentResponse);

      const all = await appointmentService.getAppointments();

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(all.length).toBe(3);
      expect(all.map((a) => a.id)).toEqual(["app-1", "app-2", "app-3"]);
    });

    it("6. getAppointmentById retrieves single appointment record", async () => {
      const mockGet = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        id: "single-uuid",
        patientName: "Single Patient",
        patientPhone: "1234567890",
        status: "BOOKED",
        createdAt: "2026-11-05T01:00:00Z",
      });

      const app = await appointmentService.getAppointmentById("single-uuid");
      expect(app.id).toBe("single-uuid");
      expect(app.name).toBe("Single Patient");
      expect(mockGet).toHaveBeenCalledWith("/appointments/single-uuid");
    });

    it("7. completeAppointment calls PATCH /appointments/{id}/complete", async () => {
      const mockPatch = vi.spyOn(apiClient, "patch").mockResolvedValueOnce({
        id: "complete-uuid",
        patientName: "Patient Done",
        patientPhone: "1234567890",
        status: "COMPLETED",
        createdAt: "2026-11-05T01:00:00Z",
        completedAt: "2026-11-05T01:30:00Z",
      });

      const updated = await appointmentService.completeAppointment("complete-uuid");
      expect(updated.status).toBe("completed");
      expect(updated.completedAt).toBe("2026-11-05T01:30:00Z");
      expect(mockPatch).toHaveBeenCalledWith("/appointments/complete-uuid/complete");
    });

    it("7b. getAppointments detects stagnant pagination loop and throws explicit error", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({
        content: [
          { id: "stagnant-id", patientName: "Patient Loop", status: "BOOKED", createdAt: "2026-11-05T01:00:00Z" },
        ],
        page: 0,
        size: 1,
        totalElements: 10,
        totalPages: 10,
        last: false,
        first: true,
      } as BackendPagedAppointmentResponse);

      await expect(appointmentService.getAppointments()).rejects.toThrow(
        /Stagnant pagination detected|Pagination cycle detected/
      );
    });
  });

  describe("B. Public Appointment Submission (Contact.tsx)", () => {
    it("8. successfully submits appointment with generated UUID and resets form", async () => {
      const mockAddAppointment = vi
        .spyOn(appointmentService, "addAppointment")
        .mockResolvedValueOnce({
          id: "new-app-id",
          name: "Sunita Verma",
          phone: "9876543210",
          email: "sunita@example.com",
          doctor: "Dr. Vikas Gupta",
          message: "Need consultation",
          status: "booked",
          createdAt: "2026-11-05T01:00:00Z",
        });

      render(
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "Sunita Verma" },
      });
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "9876543210" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "sunita@example.com" },
      });
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "Dr. Vikas Gupta" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Describe your concern/i), {
        target: { value: "Need consultation" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      await waitFor(() => {
        expect(mockAddAppointment).toHaveBeenCalledTimes(1);
      });

      const [input, key] = mockAddAppointment.mock.calls[0];
      expect(input.name).toBe("Sunita Verma");
      expect(input.phone).toBe("9876543210");
      expect(input.email).toBe("sunita@example.com");
      expect(input.doctor).toBe("Dr. Vikas Gupta");
      expect(key).toBeDefined();

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Appointment Request Sent!",
          description: "You will recieve a call within 24 hours",
        })
      );

      // Verify form was reset
      expect(screen.getByPlaceholderText("Your full name")).toHaveValue("");
      expect(screen.getByPlaceholderText("+91 XXXXX XXXXX")).toHaveValue("");
    });

    it("9. preserves exact idempotency key on retry with unchanged payload", async () => {
      const mockAddAppointment = vi
        .spyOn(appointmentService, "addAppointment")
        .mockRejectedValueOnce(new ApiError(0, "Network timeout", undefined, "Timeout"))
        .mockResolvedValueOnce({
          id: "retry-success-id",
          name: "Retry User",
          phone: "9876543210",
          email: "",
          doctor: "",
          message: "",
          status: "booked",
          createdAt: "2026-11-05T01:00:00Z",
        });

      render(
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "Retry User" },
      });
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "9876543210" },
      });

      // First attempt - fails
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      await waitFor(() => {
        expect(mockAddAppointment).toHaveBeenCalledTimes(1);
      });
      const firstKey = mockAddAppointment.mock.calls[0][1];
      expect(firstKey).toBeDefined();

      // Retry without modifying form fields
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      await waitFor(() => {
        expect(mockAddAppointment).toHaveBeenCalledTimes(2);
      });
      const secondKey = mockAddAppointment.mock.calls[1][1];

      // MUST be identical!
      expect(secondKey).toBe(firstKey);
    });

    it("10. generates new idempotency key when form inputs change after a failed attempt", async () => {
      const mockAddAppointment = vi
        .spyOn(appointmentService, "addAppointment")
        .mockRejectedValueOnce(new ApiError(400, "Invalid phone number"))
        .mockResolvedValueOnce({
          id: "edit-success-id",
          name: "Edit User",
          phone: "9876543299",
          email: "",
          doctor: "",
          message: "",
          status: "booked",
          createdAt: "2026-11-05T01:00:00Z",
        });

      render(
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "Edit User" },
      });
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "invalid-phone" },
      });

      // First attempt
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      await waitFor(() => {
        expect(mockAddAppointment).toHaveBeenCalledTimes(1);
      });
      const firstKey = mockAddAppointment.mock.calls[0][1];

      // User corrects phone number
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "9876543299" },
      });

      // Second attempt with modified payload
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));

      await waitFor(() => {
        expect(mockAddAppointment).toHaveBeenCalledTimes(2);
      });
      const secondKey = mockAddAppointment.mock.calls[1][1];

      // Must be a brand new key because the logical request changed
      expect(secondKey).not.toBe(firstKey);
    });

    it("11. prevents duplicate concurrent submissions while request is in flight", async () => {
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const mockAddAppointment = vi
        .spyOn(appointmentService, "addAppointment")
        .mockImplementation(() => delayedPromise as Promise<never>);

      render(
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "Concurrent User" },
      });
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "9876543210" },
      });

      const button = screen.getByRole("button", { name: /Send Message/i });

      // Click once
      fireEvent.click(button);

      expect(mockAddAppointment).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();
      expect(screen.getByText("Sending...")).toBeInTheDocument();

      // Click second time while in-flight
      fireEvent.click(button);
      expect(mockAddAppointment).toHaveBeenCalledTimes(1);

      // Resolve in-flight request
      resolvePromise!({
        id: "c-id",
        name: "Concurrent User",
        phone: "9876543210",
        email: "",
        doctor: "",
        message: "",
        status: "booked",
        createdAt: "2026-11-05T01:00:00Z",
      });

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it("12. handles 409 Conflict, 429 Rate Limit, and 400 Validation errors appropriately", async () => {
      const mockAddAppointment = vi.spyOn(appointmentService, "addAppointment");

      render(
        <MemoryRouter>
          <Contact />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText("Your full name"), {
        target: { value: "Error Test" },
      });
      fireEvent.change(screen.getByPlaceholderText("+91 XXXXX XXXXX"), {
        target: { value: "9876543210" },
      });

      // Case 1: 409 Conflict
      mockAddAppointment.mockRejectedValueOnce(
        new ApiError(409, "A booking request with this Idempotency-Key is currently in progress")
      );
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Appointment in progress",
          })
        );
      });

      // Case 2: 429 Rate Limit
      mockAddAppointment.mockRejectedValueOnce(
        new ApiError(429, "Too many requests. Please slow down and try again later.")
      );
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Too many requests",
            variant: "destructive",
          })
        );
      });

      // Case 3: 400 Validation
      mockAddAppointment.mockRejectedValueOnce(
        new ApiError(400, "Patient phone contains invalid characters")
      );
      fireEvent.click(screen.getByRole("button", { name: /Send Message/i }));
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Invalid appointment details",
            description: "Patient phone contains invalid characters",
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("C. Staff Appointment Management (StaffAppointments.tsx)", () => {
    it("13. loads and displays booked and completed appointments with metrics", async () => {
      vi.spyOn(appointmentService, "getAppointments").mockResolvedValueOnce([
        {
          id: "app-b1",
          name: "Patient Booked 1",
          phone: "9876500001",
          doctor: "Dr. Vikas Gupta",
          message: "First consult",
          status: "booked",
          createdAt: "2026-11-05T01:00:00Z",
          email: "",
        },
        {
          id: "app-c1",
          name: "Patient Completed 1",
          phone: "9876500002",
          doctor: "Dr. Shefali Gupta",
          message: "Routine",
          status: "completed",
          createdAt: "2026-11-04T10:00:00Z",
          completedAt: "2026-11-04T10:30:00Z",
          email: "",
        },
      ]);

      render(<StaffAppointments />);

      expect(screen.getAllByText("Loading appointments...").length).toBeGreaterThan(0);

      await waitFor(() => {
        expect(screen.getByText("Patient Booked 1")).toBeInTheDocument();
        expect(screen.getByText("Patient Completed 1")).toBeInTheDocument();
      });

      expect(screen.getByText("Booked:").parentElement).toHaveTextContent("Booked: 1");
      expect(screen.getByText("Completed:").parentElement).toHaveTextContent("Completed: 1");
    });

    it("14. marks appointment complete and updates row without full reload", async () => {
      vi.spyOn(appointmentService, "getAppointments").mockResolvedValueOnce([
        {
          id: "target-complete-id",
          name: "To Complete",
          phone: "9876500001",
          doctor: "Dr. Vikas Gupta",
          message: "Consultation",
          status: "booked",
          createdAt: "2026-11-05T01:00:00Z",
          email: "",
        },
      ]);

      const mockCompleteAppointment = vi
        .spyOn(appointmentService, "completeAppointment")
        .mockResolvedValueOnce({
          id: "target-complete-id",
          name: "To Complete",
          phone: "9876500001",
          doctor: "Dr. Vikas Gupta",
          message: "Consultation",
          status: "completed",
          createdAt: "2026-11-05T01:00:00Z",
          completedAt: "2026-11-05T01:30:00Z",
          email: "",
        });

      render(<StaffAppointments />);

      await waitFor(() => {
        expect(screen.getByText("To Complete")).toBeInTheDocument();
      });

      const markCompleteBtn = screen.getByRole("button", { name: /Mark Complete/i });
      fireEvent.click(markCompleteBtn);

      await waitFor(() => {
        expect(mockCompleteAppointment).toHaveBeenCalledWith("target-complete-id");
      });

      // Item should now move to Completed table
      await waitFor(() => {
        expect(screen.getByText("Booked:").parentElement).toHaveTextContent("Booked: 0");
        expect(screen.getByText("Completed:").parentElement).toHaveTextContent("Completed: 1");
      });
    });

    it("15. handles 401 Unauthorized by displaying session expired and hiding data", async () => {
      vi.spyOn(appointmentService, "getAppointments").mockRejectedValueOnce(
        new ApiError(401, "Unauthorized", undefined, "Unauthorized")
      );

      render(<StaffAppointments />);

      await waitFor(() => {
        expect(
          screen.getByText("Session expired. Please log in again to view appointments.")
        ).toBeInTheDocument();
      });

      // Protected patient tables must be empty
      expect(screen.getByText("No booked appointments.")).toBeInTheDocument();
      expect(screen.getByText("No completed appointments.")).toBeInTheDocument();
    });

    it("16. handles 403 Forbidden by displaying permission denied and hiding data", async () => {
      vi.spyOn(appointmentService, "getAppointments").mockRejectedValueOnce(
        new ApiError(403, "Forbidden", undefined, "Forbidden")
      );

      render(<StaffAppointments />);

      await waitFor(() => {
        expect(
          screen.getByText("Access denied. You do not have permission to manage appointments.")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("No booked appointments.")).toBeInTheDocument();
      expect(screen.getByText("No completed appointments.")).toBeInTheDocument();
    });

    it("17. displays empty states when no appointments exist", async () => {
      vi.spyOn(appointmentService, "getAppointments").mockResolvedValueOnce([]);

      render(<StaffAppointments />);

      await waitFor(() => {
        expect(screen.getByText("No booked appointments.")).toBeInTheDocument();
        expect(screen.getByText("No completed appointments.")).toBeInTheDocument();
      });

      expect(screen.getByText("Booked:").parentElement).toHaveTextContent("Booked: 0");
      expect(screen.getByText("Completed:").parentElement).toHaveTextContent("Completed: 0");
    });
  });
});
