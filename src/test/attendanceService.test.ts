import { describe, it, expect, vi, beforeEach } from "vitest";
import { attendanceService } from "@/services/attendanceService";
import { apiClient } from "@/services/apiClient";

describe("attendanceService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches staff list via GET /staff", async () => {
    const mockStaff = [
      { id: "s-1", name: "Nurse John", role: "Nurse", phone: "123", email: "j@ggnh.org" },
    ];
    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockStaff);

    const result = await attendanceService.getStaff();
    expect(apiClient.get).toHaveBeenCalledWith("/staff");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Nurse John");
  });

  it("adds new staff member via POST /staff", async () => {
    const newMember = { name: "Dr. Sarah", role: "Physician", phone: "456", email: "s@ggnh.org" };
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({ id: "s-2", ...newMember });

    const created = await attendanceService.addStaff(newMember);
    expect(apiClient.post).toHaveBeenCalledWith("/staff", newMember);
    expect(created.id).toBe("s-2");
    expect(created.name).toBe("Dr. Sarah");
  });

  it("updates staff member via PUT /staff/:id", async () => {
    const updatedData = { name: "Dr. Sarah Wilson", role: "Senior Physician", phone: "456", email: "s@ggnh.org" };
    vi.spyOn(apiClient, "put").mockResolvedValueOnce({ id: "s-2", ...updatedData });

    const result = await attendanceService.updateStaff("s-2", updatedData);
    expect(apiClient.put).toHaveBeenCalledWith("/staff/s-2", updatedData);
    expect(result.role).toBe("Senior Physician");
  });

  it("deletes staff member via DELETE /staff/:id", async () => {
    vi.spyOn(apiClient, "delete").mockResolvedValueOnce(undefined);

    await attendanceService.removeStaff("s-2");
    expect(apiClient.delete).toHaveBeenCalledWith("/staff/s-2");
  });

  it("fetches attendance map via GET /attendance", async () => {
    const mockMap = { "2026-11-06": { "s-1": "present" as const } };
    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockMap);

    const result = await attendanceService.getAttendanceByDate("2026-11-06");
    expect(apiClient.get).toHaveBeenCalledWith("/attendance?date=2026-11-06");
    expect(result["2026-11-06"]["s-1"]).toBe("present");
  });

  it("marks staff attendance via POST /attendance/mark", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValueOnce({});

    await attendanceService.markAttendance("2026-11-06", "s-1", "present");
    expect(apiClient.post).toHaveBeenCalledWith("/attendance/mark", {
      date: "2026-11-06",
      staffId: "s-1",
      status: "present",
    });
  });

  it("clears attendance via DELETE /attendance", async () => {
    vi.spyOn(apiClient, "delete").mockResolvedValueOnce(undefined);

    await attendanceService.clearAttendance("2026-11-06", "s-1");
    expect(apiClient.delete).toHaveBeenCalledWith("/attendance?date=2026-11-06&staffId=s-1");
  });
});

