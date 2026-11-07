import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { apiClient, ApiError } from "@/services/apiClient";
import type { BackendUserProfile } from "@/services/userService";

// Keep track of onAuthStateChanged listener
let authStateListener: ((user: unknown) => void) | null = null;

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSendEmailVerification = vi.fn().mockResolvedValue(undefined);

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    authStateListener = callback;
    return vi.fn(); // unsubscribe
  }),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
}));

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: {
    currentUser: null,
  },
  isFirebaseConfigured: true,
}));

const TestConsumer = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-loading">{String(auth.isLoading)}</div>
      <div data-testid="is-authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="is-access-active">{String(auth.isAccessActive)}</div>
      <div data-testid="user-email">{auth.userEmail}</div>
      <div data-testid="user-role">{auth.userRole}</div>
      <div data-testid="auth-error">{auth.authError}</div>
      <div data-testid="can-manage-users">{String(auth.canManageUsers)}</div>
      <div data-testid="can-manage-attendance">{String(auth.canManageAttendance)}</div>
      <button
        data-testid="login-btn"
        onClick={() => void auth.login("test@ggnh.org", "password123")}
      >
        Login
      </button>
    </div>
  );
};

describe("AuthContext Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateListener = null;
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Firebase authentication state changes: unauthenticated on start, transitions cleanly", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading
    expect(authStateListener).toBeTypeOf("function");

    // Simulate Firebase reporting no user signed in
    await act(async () => {
      authStateListener!(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("user-email").textContent).toBe("");
    expect(screen.getByTestId("user-role").textContent).toBe("viewer");
  });

  it("2. Firebase user with no PostgreSQL application account (unregistered)", async () => {
    const getSpy = vi.spyOn(apiClient, "get").mockRejectedValue(
      new ApiError(401, "User account not found in database. Contact administrator or register.", undefined, "Unauthorized")
    );
    const postSpy = vi.spyOn(apiClient, "post").mockRejectedValue(
      new ApiError(401, "User account not found in database.", undefined, "Unauthorized")
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Simulate Firebase user signs in with verified email, but not found in PostgreSQL
    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-unregistered",
        email: "unknown@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(getSpy).toHaveBeenCalledWith("/auth/me");
    expect(postSpy).toHaveBeenCalledWith("/auth/sync");
    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("User account not found in database");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("2b. Firebase user with unverified email cannot link or register", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(
      new ApiError(401, "User account not found in database. Contact administrator or register.", undefined, "Unauthorized")
    );
    const postSpy = vi.spyOn(apiClient, "post");

    const mockReload = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Simulate Firebase user signs in with UNVERIFIED email
    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-unverified",
        email: "unverified@ggnh.org",
        emailVerified: false,
        reload: mockReload,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    // Reload was attempted to check if user verified in another tab
    expect(mockReload).toHaveBeenCalled();
    // Sync should NOT be attempted when email remains unverified
    expect(postSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("Email address must be verified");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("2c. Refreshes user via reload() when email is verified externally", async () => {
    const mockUser: {
      uid: string;
      email: string;
      emailVerified: boolean;
      reload: () => Promise<void>;
      getIdToken: (force?: boolean) => Promise<string>;
    } = {
      uid: "firebase-uid-external-verify",
      email: "newlyverified@ggnh.org",
      emailVerified: false,
      reload: async () => {
        // Simulates user clicking verification link before reloading state
        mockUser.emailVerified = true;
      },
      getIdToken: vi.fn().mockResolvedValue("fresh-verified-token"),
    };

    const activeProfile: BackendUserProfile = {
      id: "uuid-newly-verified",
      email: "newlyverified@ggnh.org",
      active: true,
      roles: ["viewer"],
    };

    vi.spyOn(apiClient, "get").mockResolvedValue(activeProfile);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!(mockUser);
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(mockUser.emailVerified).toBe(true);
    expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
    expect(screen.getByTestId("user-email").textContent).toBe("newlyverified@ggnh.org");
  });

  it("3. Pending application account: rejected with pending message and logged out", async () => {
    // Backend returns 403 Forbidden for pending user
    vi.spyOn(apiClient, "get").mockRejectedValue(
      new ApiError(403, "Account pending approval or inactive. Please contact an administrator.", undefined, "Forbidden")
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-pending",
        email: "pending@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("is-access-active").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("Account pending approval");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("3b. Pending application account returning active: false in profile is rejected", async () => {
    const pendingProfile: BackendUserProfile = {
      id: "uuid-pending-2",
      email: "pending2@ggnh.org",
      active: false,
      roles: ["viewer"],
      permissions: {
        manageAttendance: false,
        manageAppointments: false,
        manageUsers: false,
        manageInventory: false,
        manageInventoryReports: false,
      },
    };

    vi.spyOn(apiClient, "get").mockResolvedValue(pendingProfile);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-pending-2",
        email: "pending2@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("Account pending approval");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("4. Active application account: sets authenticated profile, roles, and permissions from PostgreSQL", async () => {
    const activeOwnerProfile: BackendUserProfile = {
      id: "uuid-owner",
      email: "owner@ggnh.org",
      active: true,
      roles: ["owner"],
      permissions: {
        manageAttendance: true,
        manageAppointments: true,
        manageUsers: true,
        manageInventory: true,
        manageInventoryReports: true,
      },
    };

    vi.spyOn(apiClient, "get").mockResolvedValue(activeOwnerProfile);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-owner",
        email: "owner@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("true");
    expect(screen.getByTestId("is-access-active").textContent).toBe("true");
    expect(screen.getByTestId("user-email").textContent).toBe("owner@ggnh.org");
    expect(screen.getByTestId("user-role").textContent).toBe("owner");
    expect(screen.getByTestId("can-manage-users").textContent).toBe("true");
    expect(screen.getByTestId("can-manage-attendance").textContent).toBe("true");
    expect(screen.getByTestId("auth-error").textContent).toBe("");
  });

  it("handles backend temporarily unavailable (status 0) distinctly from unauthorized", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(
      new ApiError(0, "Network error. Please check your connection.", undefined, "NetworkError")
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-any",
        email: "user@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("Backend service is unavailable");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("handles backend HTTP 500 error distinctly from unauthorized or pending", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(
      new ApiError(500, "Internal Server Error", undefined, "InternalServerError")
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      authStateListener!({
        uid: "firebase-uid-500",
        email: "user500@ggnh.org",
        emailVerified: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("is-loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("is-authenticated").textContent).toBe("false");
    expect(screen.getByTestId("auth-error").textContent).toContain("Backend server error");
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("login() rejects unverified email without calling backend", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "user-unverified-login",
        email: "unverified@ggnh.org",
        emailVerified: false,
        reload: vi.fn().mockResolvedValue(undefined),
      },
    });

    const getSpy = vi.spyOn(apiClient, "get");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByTestId("login-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-error").textContent).toContain("Email address must be verified");
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
