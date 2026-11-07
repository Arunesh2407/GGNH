import { firebaseAuth } from "@/lib/firebase";

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly data?: unknown;
  readonly isUnauthorized: boolean;
  readonly isForbidden: boolean;
  readonly isNotFound: boolean;
  readonly isRateLimited: boolean;
  readonly isServerError: boolean;

  constructor(status: number, message: string, data?: unknown, statusText?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText || "";
    this.data = data;
    this.isUnauthorized = status === 401;
    this.isForbidden = status === 403;
    this.isNotFound = status === 404;
    this.isRateLimited = status === 429;
    this.isServerError = status >= 500 && status < 600;
  }
}

export type ApiRequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  skipRetry?: boolean;
  forceRefreshToken?: boolean;
  timeoutMs?: number;
};

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setOnUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

const DEFAULT_BASE_URL = "http://localhost:8080/api/v1";

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_SPRINGBOOT_API_URL;
  const baseUrl = configured && typeof configured === "string" && configured.trim()
    ? configured.trim()
    : DEFAULT_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (!firebaseAuth) {
    return null;
  }
  // Wait for Firebase to finish resolving stored auth state on initial page load
  if (!firebaseAuth.currentUser && typeof firebaseAuth.authStateReady === "function") {
    try {
      await firebaseAuth.authStateReady();
    } catch {
      // Fall through to standard currentUser check
    }
  }
  if (!firebaseAuth.currentUser) {
    return null;
  }
  try {
    return await firebaseAuth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as T;
    } catch {
      return undefined as unknown as T;
    }
  }

  const text = await response.text();
  return text as unknown as T;
}

async function parseErrorResponse(response: Response): Promise<{ message: string; data?: unknown }> {
  const contentType = response.headers.get("content-type") || "";
  let message = "";
  let data: unknown = undefined;

  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();
      data = json;
      if (json && typeof json === "object") {
        if ("message" in json && typeof (json as { message: unknown }).message === "string") {
          message = (json as { message: string }).message;
        } else if ("error" in json && typeof (json as { error: unknown }).error === "string") {
          message = (json as { error: string }).error;
        }
      }
    } catch {
      // Fallback below
    }
  } else {
    try {
      const text = await response.text();
      if (text.trim()) {
        message = text.trim();
      }
    } catch {
      // Fallback below
    }
  }

  if (!message) {
    if (response.status === 401) {
      message = "Unauthorized: Please log in to continue.";
    } else if (response.status === 403) {
      message = "Forbidden: Account is inactive or lacks required permissions.";
    } else if (response.status === 404) {
      message = "Requested resource was not found.";
    } else if (response.status === 429) {
      message = "Too many requests. Please slow down and try again later.";
    } else if (response.status >= 500) {
      message = "Server error occurred. Please try again later.";
    } else {
      message = response.statusText || `Request failed with status ${response.status}`;
    }
  }

  return { message, data };
}

export async function apiRequest<T = void>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    params,
    skipAuth = false,
    skipRetry = false,
    forceRefreshToken = false,
    timeoutMs = 15000,
    headers: customHeaders = {},
    ...fetchOptions
  } = options;

  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  let urlString = `${baseUrl}${normalizedEndpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      urlString += (urlString.includes("?") ? "&" : "?") + queryString;
    }
  }

  const executeRequest = async (tokenOverride?: string | null): Promise<Response> => {
    const headers = new Headers(customHeaders);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (fetchOptions.body && !headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (!skipAuth && !headers.has("Authorization")) {
      const token = tokenOverride !== undefined ? tokenOverride : await getAuthToken(forceRefreshToken);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(urlString, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new ApiError(0, `Request timeout after ${timeoutMs}ms`, undefined, "Timeout");
      }
      throw new ApiError(0, err instanceof Error ? err.message : "Network error. Please check your connection.", undefined, "NetworkError");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response = await executeRequest();

  // Registration and sync endpoints must not retry on 401 to prevent registration/sync loops
  const isAuthProvisioningEndpoint =
    normalizedEndpoint === "/auth/register" || normalizedEndpoint === "/auth/sync";

  // Retry once with refreshed token on 401 if user is logged in, not an auth provisioning endpoint,
  // and refresh was not already forced
  if (
    response.status === 401 &&
    !skipAuth &&
    !skipRetry &&
    !forceRefreshToken &&
    !isAuthProvisioningEndpoint &&
    firebaseAuth?.currentUser
  ) {
    const refreshedToken = await getAuthToken(true);
    if (refreshedToken) {
      response = await executeRequest(refreshedToken);
    }
  }

  if (!response.ok) {
    // If request remains 401 for an authenticated session on normal endpoints, notify handler to clear session
    if (
      response.status === 401 &&
      !skipAuth &&
      !isAuthProvisioningEndpoint &&
      firebaseAuth?.currentUser
    ) {
      unauthorizedHandler?.();
    }

    const { message, data } = await parseErrorResponse(response);
    throw new ApiError(response.status, message, data, response.statusText);
  }

  return await parseResponseBody<T>(response);
}

export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
