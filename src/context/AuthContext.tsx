import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { apiClient, ApiError, setOnUnauthorizedHandler } from "@/services/apiClient";
import {
  getDefaultPermissionsForRole,
  type UserPermissions,
} from "@/services/accessControlService";
import type { BackendUserProfile } from "@/services/userService";

export type AuthRole =
  | "owner"
  | "editor"
  | "viewer"
  | "store-manager"
  | "department-head"
  | "auditor";

export type RegisterResult = {
  ok: boolean;
  error?: string;
};

const resolveBackendRole = (roles?: string[]): AuthRole => {
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return "viewer";
  }
  const normalized = roles.map((r) => r.toLowerCase());
  if (normalized.includes("owner") || normalized.includes("admin")) {
    return "owner";
  }
  if (normalized.includes("editor")) {
    return "editor";
  }
  if (normalized.includes("store-manager") || normalized.includes("store_manager")) {
    return "store-manager";
  }
  if (normalized.includes("department-head") || normalized.includes("department_head")) {
    return "department-head";
  }
  if (normalized.includes("auditor")) {
    return "auditor";
  }
  return "viewer";
};

const resolveBackendPermissions = (
  role: AuthRole,
  permissions?: BackendUserProfile["permissions"]
): UserPermissions => {
  const defaults = getDefaultPermissionsForRole(role);
  if (!permissions) {
    return defaults;
  }
  return {
    manageAttendance: permissions.manageAttendance ?? defaults.manageAttendance,
    manageAppointments: permissions.manageAppointments ?? defaults.manageAppointments,
    manageUsers: permissions.manageUsers ?? defaults.manageUsers,
    manageInventory: permissions.manageInventory ?? defaults.manageInventory,
    manageInventoryReports: permissions.manageInventoryReports ?? defaults.manageInventoryReports,
  };
};

const getRegisterErrorMessage = (error: unknown): string => {
  const firebaseCode = (error as FirebaseError | undefined)?.code;

  if (firebaseCode === "auth/email-already-in-use") {
    return "Email already exists. Try login or use another email.";
  }

  if (firebaseCode === "auth/operation-not-allowed") {
    return "Firebase Email/Password sign-in is disabled. Enable it in Firebase Console > Authentication > Sign-in method.";
  }

  if (firebaseCode === "auth/invalid-email") {
    return "Invalid email address.";
  }

  if (firebaseCode === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return `Registration failed: ${error.message}`;
  }

  return "Unable to create account right now. Try again.";
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  userEmail: string;
  userRole: AuthRole;
  isAccessActive: boolean;
  isInactivityWarningVisible: boolean;
  userPermissions: UserPermissions;
  canEditAttendance: boolean;
  canManageAttendance: boolean;
  canManageAppointments: boolean;
  canManageUsers: boolean;
  canManageInventory: boolean;
  canViewInventoryReports: boolean;
  canEditUsers: boolean;
  extendSession: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const INACTIVITY_WARNING_MS = 25 * 60 * 1000;
const ABSOLUTE_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const SESSION_METADATA_STORAGE_KEY = "ggnh.session.metadata";
const LOGOUT_BROADCAST_STORAGE_KEY = "ggnh.session.logoutAt";

type SessionMetadata = {
  email: string;
  startedAt: number;
};

const readSessionMetadata = (): SessionMetadata | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_METADATA_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SessionMetadata>;

    if (
      typeof parsed.email !== "string" ||
      typeof parsed.startedAt !== "number" ||
      !Number.isFinite(parsed.startedAt)
    ) {
      return null;
    }

    return {
      email: parsed.email.trim().toLowerCase(),
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
};

const writeSessionMetadata = (metadata: SessionMetadata) => {
  window.localStorage.setItem(
    SESSION_METADATA_STORAGE_KEY,
    JSON.stringify(metadata)
  );
};

const clearSessionMetadata = () => {
  window.localStorage.removeItem(SESSION_METADATA_STORAGE_KEY);
};

const broadcastLogout = () => {
  window.localStorage.setItem(
    LOGOUT_BROADCAST_STORAGE_KEY,
    Date.now().toString()
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<AuthRole>("viewer");
  const [isAccessActive, setIsAccessActive] = useState(true);
  const [isInactivityWarningVisible, setIsInactivityWarningVisible] =
    useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(
    getDefaultPermissionsForRole("viewer")
  );

  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absoluteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimers = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }

    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, []);

  const clearAbsoluteTimeout = useCallback(() => {
    if (absoluteTimeoutRef.current) {
      clearTimeout(absoluteTimeoutRef.current);
      absoluteTimeoutRef.current = null;
    }
  }, []);

  const performLogout = useCallback(
    async (broadcast = true) => {
      clearInactivityTimers();
      clearAbsoluteTimeout();
      setIsInactivityWarningVisible(false);
      clearSessionMetadata();

      if (broadcast) {
        broadcastLogout();
      }

      if (firebaseAuth) {
        try {
          await signOut(firebaseAuth);
        } catch {
          // Ignore logout errors
        }
      }
    },
    [clearAbsoluteTimeout, clearInactivityTimers]
  );

  // Wire API client's unauthorized callback to clear session safely on unrecoverable 401
  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      void performLogout();
    });
    return () => {
      setOnUnauthorizedHandler(null);
    };
  }, [performLogout]);

  const scheduleAbsoluteTimeout = useCallback(
    (startedAt: number) => {
      clearAbsoluteTimeout();

      const elapsed = Date.now() - startedAt;
      const remaining = ABSOLUTE_SESSION_TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        setAuthError("Session expired after 24 hours. Please log in again.");
        void performLogout();
        return;
      }

      absoluteTimeoutRef.current = setTimeout(() => {
        setAuthError("Session expired after 24 hours. Please log in again.");
        void performLogout();
      }, remaining);
    },
    [clearAbsoluteTimeout, performLogout]
  );

  const scheduleInactivityTimers = useCallback(() => {
    clearInactivityTimers();
    setIsInactivityWarningVisible(false);

    warningTimeoutRef.current = setTimeout(() => {
      setIsInactivityWarningVisible(true);
    }, INACTIVITY_WARNING_MS);

    logoutTimeoutRef.current = setTimeout(async () => {
      setIsInactivityWarningVisible(false);
      setAuthError("Logged out after 30 minutes of inactivity.");
      await performLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearInactivityTimers, performLogout]);

  const extendSession = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }
    scheduleInactivityTimers();
  }, [isAuthenticated, scheduleInactivityTimers]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setIsLoading(false);
      setAuthError(
        "Firebase is not configured. Add Firebase env variables to enable admin login."
      );
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        clearInactivityTimers();
        clearAbsoluteTimeout();
        setIsInactivityWarningVisible(false);
        setIsAuthenticated(false);
        setUserEmail("");
        setUserRole("viewer");
        setIsAccessActive(true);
        setUserPermissions(getDefaultPermissionsForRole("viewer"));
        setIsLoading(false);
        return;
      }

      // Refresh Firebase user details if not verified to detect recent email verification
      if (!user.emailVerified) {
        try {
          await user.reload();
        } catch {
          // Ignore reload error
        }
        if (user.emailVerified) {
          try {
            await user.getIdToken(true);
          } catch {
            // Ignore token refresh error
          }
        }
      }

      // If email is still unverified, reject access and sign out
      if (!user.emailVerified) {
        clearInactivityTimers();
        clearAbsoluteTimeout();
        setIsInactivityWarningVisible(false);
        setIsAuthenticated(false);
        setIsAccessActive(false);
        setAuthError("Email address must be verified before account registration or access.");
        await performLogout();
        setIsLoading(false);
        return;
      }

      const normalizedEmail = user.email?.trim().toLowerCase() ?? "";
      const existingSession = readSessionMetadata();
      const sessionStartedAt =
        existingSession && existingSession.email === normalizedEmail
          ? existingSession.startedAt
          : Date.now();

      if (!existingSession || existingSession.email !== normalizedEmail) {
        writeSessionMetadata({
          email: normalizedEmail,
          startedAt: sessionStartedAt,
        });
      }

      if (Date.now() - sessionStartedAt >= ABSOLUTE_SESSION_TIMEOUT_MS) {
        setAuthError("Session expired after 24 hours. Please log in again.");
        await performLogout();
        setIsLoading(false);
        return;
      }

      try {
        let profile: BackendUserProfile;
        try {
          profile = await apiClient.get<BackendUserProfile>("/auth/me");
        } catch (error) {
          if (error instanceof ApiError && error.isUnauthorized && user.emailVerified) {
            profile = await apiClient.post<BackendUserProfile>("/auth/sync");
          } else {
            throw error;
          }
        }

        const active = profile.active ?? profile.isActive ?? false;
        const role = resolveBackendRole(profile.roles);
        const permissions = resolveBackendPermissions(role, profile.permissions);

        if (!active) {
          clearInactivityTimers();
          setIsInactivityWarningVisible(false);
          setAuthError(
            "Account pending approval. Please wait for super admin access approval."
          );
          setUserEmail(profile.email || user.email || "");
          setUserRole(role);
          setIsAccessActive(false);
          setUserPermissions(permissions);
          setIsAuthenticated(false);
          await performLogout();
          setIsLoading(false);
          return;
        }

        setAuthError("");
        setUserEmail(profile.email || user.email || "");
        setUserRole(role);
        setIsAccessActive(true);
        setUserPermissions(permissions);
        setIsAuthenticated(true);
        scheduleInactivityTimers();
        scheduleAbsoluteTimeout(sessionStartedAt);
        setIsLoading(false);
      } catch (error) {
        clearInactivityTimers();
        setIsInactivityWarningVisible(false);
        setIsAuthenticated(false);
        setIsAccessActive(false);

        if (error instanceof ApiError) {
          if (error.isForbidden) {
            setAuthError(
              "Account pending approval or inactive. Please contact an administrator."
            );
          } else if (error.isUnauthorized) {
            if (!user.emailVerified) {
              setAuthError(
                "Email address must be verified before account registration or access."
              );
            } else {
              setAuthError(
                "User account not found in database. Contact administrator or register."
              );
            }
          } else if (error.status === 0) {
            setAuthError(
              "Backend service is unavailable. Please check your connection or server status."
            );
          } else if (error.isServerError) {
            setAuthError(
              "Backend server error. Please try again later."
            );
          } else {
            setAuthError(
              error.message ||
              "Backend service temporarily unavailable. Please try again later."
            );
          }
        } else {
          setAuthError(
            "Backend service is unavailable. Please check your connection or server status."
          );
        }

        await performLogout();
        setIsLoading(false);
      }
    });

    return () => {
      clearInactivityTimers();
      clearAbsoluteTimeout();
      unsubscribe();
    };
  }, [
    clearAbsoluteTimeout,
    clearInactivityTimers,
    performLogout,
    scheduleAbsoluteTimeout,
    scheduleInactivityTimers,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearInactivityTimers();
      setIsInactivityWarningVisible(false);
      return;
    }

    const onActivity = () => {
      scheduleInactivityTimers();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleInactivityTimers();
      }
    };

    const onStorageChange = (event: StorageEvent) => {
      if (
        event.key === LOGOUT_BROADCAST_STORAGE_KEY &&
        event.newValue !== null &&
        isAuthenticated
      ) {
        setAuthError("Session ended in another tab. Please log in again.");
        void performLogout(false);
      }
    };

    window.addEventListener("mousedown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    window.addEventListener("scroll", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("storage", onStorageChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("storage", onStorageChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    clearInactivityTimers,
    isAuthenticated,
    performLogout,
    scheduleInactivityTimers,
  ]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      if (!isFirebaseConfigured || !firebaseAuth) {
        setAuthError(
          "Firebase is not configured. Add Firebase env variables in .env."
        );
        return false;
      }

      try {
        setAuthError("");
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password
        );

        // Refresh user to check if email was verified recently
        if (!credential.user.emailVerified) {
          try {
            await credential.user.reload();
          } catch {
            // Ignore reload error
          }
          if (credential.user.emailVerified) {
            try {
              await credential.user.getIdToken(true);
            } catch {
              // Ignore token refresh error
            }
          }
        }

        // If email is still unverified, reject immediately
        if (!credential.user.emailVerified) {
          setAuthError(
            "Email address must be verified before account registration or access."
          );
          await signOut(firebaseAuth);
          return false;
        }

        try {
          let profile: BackendUserProfile;
          try {
            profile = await apiClient.get<BackendUserProfile>("/auth/me");
          } catch (err) {
            if (
              err instanceof ApiError &&
              err.isUnauthorized &&
              credential.user.emailVerified
            ) {
              profile = await apiClient.post<BackendUserProfile>("/auth/sync");
            } else {
              throw err;
            }
          }

          const active = profile.active ?? profile.isActive ?? false;
          if (!active) {
            setAuthError(
              "Account pending approval. Please wait for super admin access approval."
            );
            await signOut(firebaseAuth);
            return false;
          }

          return true;
        } catch (apiErr) {
          await signOut(firebaseAuth);
          if (apiErr instanceof ApiError) {
            if (apiErr.isForbidden) {
              setAuthError(
                "Account pending approval or inactive. Please contact an administrator."
              );
            } else if (apiErr.isUnauthorized) {
              if (!credential.user.emailVerified) {
                setAuthError(
                  "Email address must be verified before account registration or access."
                );
              } else {
                setAuthError(
                  "User account not found in database. Contact administrator or register."
                );
              }
            } else if (apiErr.status === 0) {
              setAuthError(
                "Backend service is unavailable. Please check your connection or server status."
              );
            } else if (apiErr.isServerError) {
              setAuthError(
                "Backend server error. Please try again later."
              );
            } else {
              setAuthError(
                apiErr.message || "Backend service temporarily unavailable."
              );
            }
          } else {
            setAuthError(
              "Backend service is unavailable. Please check your connection or server status."
            );
          }
          return false;
        }
      } catch (error) {
        setAuthError("Invalid email or password.");
        return false;
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string): Promise<RegisterResult> => {
      if (!isFirebaseConfigured || !firebaseAuth) {
        const message =
          "Firebase is not configured. Add Firebase env variables in .env.";
        setAuthError(message);
        return { ok: false, error: message };
      }

      const normalizedEmail = email.trim().toLowerCase();

      try {
        setAuthError("");
        const userCredential = await createUserWithEmailAndPassword(
          firebaseAuth,
          normalizedEmail,
          password
        );

        try {
          await sendEmailVerification(userCredential.user);
        } catch {
          // Best-effort email verification send
        }

        if (userCredential.user.emailVerified) {
          try {
            await apiClient.post("/auth/register");
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              // Existing identity conflict handled
            }
          }
        }

        await signOut(firebaseAuth);
        setAuthError(
          "Account created. Wait for super admin approval before login."
        );
        return { ok: true };
      } catch (error) {
        const message = getRegisterErrorMessage(error);
        setAuthError(message);
        return { ok: false, error: message };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await performLogout();
  }, [performLogout]);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      authError,
      userEmail,
      userRole,
      isAccessActive,
      isInactivityWarningVisible,
      userPermissions,
      canEditAttendance:
        userPermissions.manageAttendance && userRole !== "viewer",
      canManageAttendance: userPermissions.manageAttendance,
      canManageAppointments: userPermissions.manageAppointments,
      canManageUsers: userPermissions.manageUsers,
      canManageInventory: userPermissions.manageInventory,
      canViewInventoryReports:
        userPermissions.manageInventory ||
        userPermissions.manageInventoryReports,
      canEditUsers: userPermissions.manageUsers && userRole !== "viewer",
      extendSession,
      login,
      register,
      logout,
    }),
    [
      isAuthenticated,
      isLoading,
      authError,
      userEmail,
      userRole,
      isAccessActive,
      isInactivityWarningVisible,
      userPermissions,
      extendSession,
      login,
      register,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
