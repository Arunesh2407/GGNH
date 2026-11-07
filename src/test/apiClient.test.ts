import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  apiClient,
  ApiError,
  getApiBaseUrl,
  setOnUnauthorizedHandler,
} from "@/services/apiClient";
import { firebaseAuth } from "@/lib/firebase";

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: {
    currentUser: null,
  },
  isFirebaseConfigured: true,
}));

describe("apiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setOnUnauthorizedHandler(null);
    if (firebaseAuth) {
      (firebaseAuth as { currentUser: unknown }).currentUser = null;
    }
  });

  it("reads configured backend base URL without trailing slash", () => {
    const baseUrl = getApiBaseUrl();
    expect(baseUrl).toBeDefined();
    expect(baseUrl.endsWith("/")).toBe(false);
  });

  it("5. API client attaches Firebase ID token when user is logged in", async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue("test-valid-firebase-token");
    (firebaseAuth as { currentUser: unknown }).currentUser = {
      getIdToken: mockGetIdToken,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    const result = await apiClient.get<{ success: boolean }>("/auth/me");

    expect(result).toEqual({ success: true });
    expect(mockGetIdToken).toHaveBeenCalledWith(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-valid-firebase-token");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("does not attach Authorization header if user is not signed in", async () => {
    (firebaseAuth as { currentUser: unknown }).currentUser = null;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ status: "ok" }),
    });
    global.fetch = mockFetch;

    await apiClient.post("/appointments", { name: "John" });

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("6. API client handles HTTP 401 Unauthorized separately", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: 401,
        error: "Unauthorized",
        message: "User account not found in database. Contact administrator or register.",
      }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.get("/auth/me")).rejects.toThrow(ApiError);

    try {
      await apiClient.get("/auth/me");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.isUnauthorized).toBe(true);
      expect(apiErr.isForbidden).toBe(false);
      expect(apiErr.message).toBe("User account not found in database. Contact administrator or register.");
    }
  });

  it("7. API client handles HTTP 403 Forbidden separately", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: 403,
        error: "Forbidden",
        message: "Account pending approval or inactive. Please contact an administrator.",
      }),
    });
    global.fetch = mockFetch;

    try {
      await apiClient.get("/auth/me");
      expect.fail("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.isForbidden).toBe(true);
      expect(apiErr.isUnauthorized).toBe(false);
      expect(apiErr.message).toBe("Account pending approval or inactive. Please contact an administrator.");
    }
  });

  it("8. API client handles HTTP 204 No Content without parsing JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      headers: new Headers(),
      json: vi.fn(),
      text: vi.fn(),
    });
    global.fetch = mockFetch;

    const result = await apiClient.delete("/attendance");
    expect(result).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("9. Expired token handling: retries once with forced refresh token on 401", async () => {
    const mockGetIdToken = vi
      .fn()
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("refreshed-token");

    (firebaseAuth as { currentUser: unknown }).currentUser = {
      getIdToken: mockGetIdToken,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "Token expired" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ success: true, refreshed: true }),
      });
    global.fetch = mockFetch;

    const result = await apiClient.get<{ success: boolean; refreshed: boolean }>("/auth/me");

    expect(result).toEqual({ success: true, refreshed: true });
    expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(1, false);
    expect(mockGetIdToken).toHaveBeenNthCalledWith(2, true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const secondCallHeaders = mockFetch.mock.calls[1][1]?.headers as Headers;
    expect(secondCallHeaders.get("Authorization")).toBe("Bearer refreshed-token");
  });

  it("does not retry 401 on /auth/register or /auth/sync (prevents loops)", async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue("token-xyz");
    (firebaseAuth as { currentUser: unknown }).currentUser = {
      getIdToken: mockGetIdToken,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "User account not found" }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.post("/auth/sync")).rejects.toThrow(ApiError);
    // Should NOT retry token refresh on auth sync endpoint
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockGetIdToken).toHaveBeenCalledTimes(1);
    expect(mockGetIdToken).toHaveBeenCalledWith(false);
  });

  it("invokes unauthorizedHandler on token refresh failure", async () => {
    const mockUnauthorizedHandler = vi.fn();
    setOnUnauthorizedHandler(mockUnauthorizedHandler);

    // Refresh throws or returns null
    const mockGetIdToken = vi
      .fn()
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce(null);

    (firebaseAuth as { currentUser: unknown }).currentUser = {
      getIdToken: mockGetIdToken,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Session expired" }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.get("/users")).rejects.toThrow(ApiError);
    expect(mockUnauthorizedHandler).toHaveBeenCalledTimes(1);
  });

  it("never logs tokens or credentials to console", async () => {
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    (firebaseAuth as { currentUser: unknown }).currentUser = {
      getIdToken: vi.fn().mockResolvedValue("secret-token-12345"),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ data: "safe" }),
    });

    await apiClient.get("/auth/me");

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("handles HTTP 429 Rate Limiting with appropriate flag", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: 429,
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please wait before retrying.",
      }),
    });
    global.fetch = mockFetch;

    try {
      await apiClient.post("/appointments", { patient: "Jane" });
      expect.fail("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(429);
      expect(apiErr.isRateLimited).toBe(true);
      expect(apiErr.message).toContain("Rate limit exceeded");
    }
  });

  it("handles HTTP 500 Internal Server Error safely", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        status: 500,
        error: "Internal Server Error",
        message: "An unexpected database exception occurred.",
      }),
    });
    global.fetch = mockFetch;

    try {
      await apiClient.get("/staff");
      expect.fail("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.isServerError).toBe(true);
    }
  });

  it("handles network error gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await apiClient.get("/users");
      expect.fail("Should have thrown ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(0);
      expect(apiErr.statusText).toBe("NetworkError");
    }
  });
});
