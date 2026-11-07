import { describe, it, expect, vi, beforeEach } from "vitest";
import { userService, toUserAccessRecord, type BackendUserProfile } from "@/services/userService";
import { apiClient, ApiError } from "@/services/apiClient";

describe("10. User access management requests (userService)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users from GET /users and correctly maps contracts", async () => {
    const mockProfiles: BackendUserProfile[] = [
      {
        id: "uuid-2",
        email: "bob@ggnh.org",
        active: true,
        roles: ["editor"],
        permissions: {
          manageAttendance: true,
          manageAppointments: true,
          manageUsers: false,
          manageInventory: true,
          manageInventoryReports: true,
        },
      },
      {
        id: "uuid-1",
        email: "alice@ggnh.org",
        active: false,
        roles: ["viewer"],
        permissions: {
          manageAttendance: false,
          manageAppointments: false,
          manageUsers: false,
          manageInventory: false,
          manageInventoryReports: false,
        },
      },
    ];

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue(mockProfiles);

    const users = await userService.listUsers();

    expect(getSpy).toHaveBeenCalledWith("/users");
    expect(users).toHaveLength(2);
    // Should be sorted alphabetically by email
    expect(users[0].email).toBe("alice@ggnh.org");
    expect(users[0].role).toBe("viewer");
    expect(users[0].isActive).toBe(false);

    expect(users[1].email).toBe("bob@ggnh.org");
    expect(users[1].role).toBe("editor");
    expect(users[1].isActive).toBe(true);
  });

  it("updates user status via PATCH /users/{id}/status", async () => {
    const mockUpdated: BackendUserProfile = {
      id: "uuid-1",
      email: "alice@ggnh.org",
      active: true,
      roles: ["viewer"],
      permissions: {
        manageAttendance: false,
        manageAppointments: false,
        manageUsers: false,
        manageInventory: false,
        manageInventoryReports: false,
      },
    };

    const patchSpy = vi.spyOn(apiClient, "patch").mockResolvedValue(mockUpdated);

    const result = await userService.updateStatus("uuid-1", true);

    expect(patchSpy).toHaveBeenCalledWith("/users/uuid-1/status", { active: true });
    expect(result.id).toBe("uuid-1");
    expect(result.isActive).toBe(true);
  });

  it("propagates backend rejection on status update (e.g. last owner or self-deactivation)", async () => {
    vi.spyOn(apiClient, "patch").mockRejectedValue(
      new ApiError(400, "Cannot deactivate the last active owner.", undefined, "Bad Request")
    );

    await expect(userService.updateStatus("uuid-owner", false)).rejects.toThrow(
      "Cannot deactivate the last active owner."
    );
  });

  it("updates user access via PUT /users/{id}/access", async () => {
    const mockUpdated: BackendUserProfile = {
      id: "uuid-2",
      email: "bob@ggnh.org",
      active: true,
      roles: ["store-manager"],
      permissions: {
        manageAttendance: false,
        manageAppointments: false,
        manageUsers: false,
        manageInventory: true,
        manageInventoryReports: true,
      },
    };

    const putSpy = vi.spyOn(apiClient, "put").mockResolvedValue(mockUpdated);

    const result = await userService.updateAccess("uuid-2", "store-manager", {
      manageAttendance: false,
      manageAppointments: false,
      manageUsers: false,
      manageInventory: true,
      manageInventoryReports: true,
    });

    expect(putSpy).toHaveBeenCalledWith("/users/uuid-2/access", {
      role: "store-manager",
      permissions: {
        manageAttendance: false,
        manageAppointments: false,
        manageUsers: false,
        manageInventory: true,
        manageInventoryReports: true,
      },
    });
    expect(result.role).toBe("store-manager");
    expect(result.permissions.manageInventory).toBe(true);
  });

  it("propagates backend rejection on access update (e.g. self-escalation)", async () => {
    vi.spyOn(apiClient, "put").mockRejectedValue(
      new ApiError(403, "Administrators cannot modify their own roles or permissions.", undefined, "Forbidden")
    );

    await expect(
      userService.updateAccess("uuid-admin", "owner", {
        manageAttendance: true,
        manageAppointments: true,
        manageUsers: true,
        manageInventory: true,
        manageInventoryReports: true,
      })
    ).rejects.toThrow("Administrators cannot modify their own roles or permissions.");
  });

  it("maps owner role correctly even if multiple roles present", () => {
    const profile: BackendUserProfile = {
      id: "uuid-owner",
      email: "owner@ggnh.org",
      active: true,
      roles: ["viewer", "owner"],
    };

    const record = toUserAccessRecord(profile);
    expect(record.role).toBe("owner");
    expect(record.isActive).toBe(true);
    expect(record.permissions.manageUsers).toBe(true);
    expect(record.permissions.manageAttendance).toBe(true);
  });
});
