import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import {
  accessControlService,
  getDefaultPermissionsForRole,
  type UserPermissions,
} from "@/services/accessControlService";

type AuthRole =
  | "owner"
  | "editor"
  | "viewer"
  | "store-manager"
  | "department-head"
  | "auditor";

const toNormalizedEmailSet = (value?: string) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

const configuredEditorEmails = toNormalizedEmailSet(
  import.meta.env.VITE_ATTENDANCE_EDITOR_EMAILS,
);

const configuredSuperAdminEmails = toNormalizedEmailSet(
  import.meta.env.VITE_SUPER_ADMIN_EMAILS,
);

const resolveRoleFromClaims = (claimValue: unknown): AuthRole | null => {
  if (typeof claimValue !== "string") {
    return null;
  }

  const normalized = claimValue.trim().toLowerCase();

  if (normalized === "owner" || normalized === "admin") {
    return "owner";
  }

  if (normalized === "editor") {
    return "editor";
  }

  if (normalized === "viewer") {
    return "viewer";
  }

  if (normalized === "store-manager" || normalized === "store_manager") {
    return "store-manager";
  }

  if (normalized === "department-head" || normalized === "department_head") {
    return "department-head";
  }

  if (normalized === "auditor") {
    return "auditor";
  }

  return null;
};

type ResolvedAccess = {
  role: AuthRole;
  isActive: boolean;
  permissions: UserPermissions;
};

type RegisterResult = {
  ok: boolean;
  error?: string;
};

const getRegisterErrorMessage = (error: unknown) => {
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

  if (
    error instanceof Error &&
    /not authorized|permission|unauthorized|missing scope/i.test(error.message)
  ) {
    return "Account could not be queued for approval due to Appwrite permission settings. Ask super admin to allow create/read/update/delete on the user_access collection.";
  }

  if (error instanceof Error && error.message.trim()) {
    return `Registration failed: ${error.message}`;
  }

  const errorCode = (error as { code?: unknown } | null)?.code;
  if (typeof errorCode === "string" && errorCode.trim()) {
    return `Registration failed (${errorCode}).`;
  }

  return "Unable to create account right now. Try again.";
};

const resolveUserAccess = async (user: User): Promise<ResolvedAccess> => {
  const normalizedEmail = user.email?.trim().toLowerCase() ?? "";

  if (configuredSuperAdminEmails.has(normalizedEmail)) {
    return {
      role: "owner",
      isActive: true,
      permissions: getDefaultPermissionsForRole("owner"),
    };
  }

  if (accessControlService.isConfigured) {
    try {
      const record = await accessControlService.getUserByEmail(normalizedEmail);

      if (record) {
        // Owner role is reserved for configured super admin emails only.
        const resolvedRole: AuthRole =
          record.role === "owner" ? "editor" : record.role;

        return {
          role: resolvedRole,
          isActive: record.isActive,
          permissions: record.permissions,
        };
      }

      // Self-heal missing access records for existing Firebase users.
      await accessControlService.upsertUser({
        email: normalizedEmail,
        role: "viewer",
        isActive: false,
        updatedBy: normalizedEmail || "system",
      });

      // Access collection is enabled and this user has no record yet.
      // Keep account pending until a super admin approves it.
      return {
        role: "viewer",
        isActive: false,
        permissions: getDefaultPermissionsForRole("viewer"),
      };
    } catch {
      // Ignore lookup failures and continue to fallback strategies.
    }
  }

  try {
    const tokenResult = await user.getIdTokenResult();
    const claimedRole =
      resolveRoleFromClaims(tokenResult.claims.role) ??
      resolveRoleFromClaims(tokenResult.claims.appRole);

    if (claimedRole) {
      return {
        role: claimedRole,
        isActive: true,
        permissions: getDefaultPermissionsForRole(claimedRole),
      };
    }
  } catch {
    // Ignore claim resolution errors and continue with email-based/default role.
  }

  if (configuredEditorEmails.size > 0) {
    return {
      role: configuredEditorEmails.has(normalizedEmail) ? "editor" : "viewer",
      isActive: true,
      permissions: getDefaultPermissionsForRole(
        configuredEditorEmails.has(normalizedEmail) ? "editor" : "viewer",
      ),
    };
  }

  // By default, all authenticated accounts can edit attendance.
  return {
    role: "editor",
    isActive: true,
    permissions: getDefaultPermissionsForRole("editor"),
  };
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  userEmail: string;
  userRole: AuthRole;
  isAccessActive: boolean;
  userPermissions: UserPermissions;
  canEditAttendance: boolean;
  canManageAttendance: boolean;
  canManageAppointments: boolean;
  canManageUsers: boolean;
  canManageInventory: boolean;
  canViewInventoryReports: boolean;
  canEditUsers: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<AuthRole>("viewer");
  const [isAccessActive, setIsAccessActive] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(
    getDefaultPermissionsForRole("viewer"),
  );

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setIsLoading(false);
      setAuthError(
        "Firebase is not configured. Add Firebase env variables to enable admin login.",
      );
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setIsAuthenticated(Boolean(user));

      if (!user) {
        setUserEmail("");
        setUserRole("viewer");
        setIsAccessActive(true);
        setUserPermissions(getDefaultPermissionsForRole("viewer"));
        setIsLoading(false);
        return;
      }

      const access = await resolveUserAccess(user);

      if (!access.isActive) {
        setAuthError(
          "Account pending approval. Please wait for super admin access approval.",
        );
        setUserEmail(user.email ?? "");
        setUserRole(access.role);
        setIsAccessActive(false);
        setUserPermissions(access.permissions);
        await signOut(firebaseAuth);
        setIsLoading(false);
        return;
      }

      setAuthError("");
      setUserEmail(user.email ?? "");
      setUserRole(access.role);
      setIsAccessActive(true);
      setUserPermissions(access.permissions);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setAuthError(
        "Firebase is not configured. Add Firebase env variables in .env.",
      );
      return false;
    }

    try {
      setAuthError("");
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return true;
    } catch (error) {
      setAuthError("Invalid email or password.");
      return false;
    }
  };

  const register = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      const message =
        "Firebase is not configured. Add Firebase env variables in .env.";
      setAuthError(message);
      return { ok: false, error: message };
    }

    if (!accessControlService.isConfigured) {
      const message =
        "User access collection is not configured. Contact super admin.";
      setAuthError(message);
      return { ok: false, error: message };
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      setAuthError("");
      const userCredential = await createUserWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password,
      );

      try {
        await accessControlService.upsertUser({
          email: normalizedEmail,
          role: "viewer",
          isActive: false,
          updatedBy: normalizedEmail,
        });
      } catch (error) {
        try {
          await deleteUser(userCredential.user);
        } catch {
          // Best-effort rollback; if this fails the account remains pending.
        }

        throw error;
      }

      await signOut(firebaseAuth);
      setAuthError(
        "Account created. Wait for super admin approval before login.",
      );
      return { ok: true };
    } catch (error) {
      const message = getRegisterErrorMessage(error);
      setAuthError(message);
      return { ok: false, error: message };
    }
  };

  const logout = async () => {
    if (!firebaseAuth) {
      return;
    }

    await signOut(firebaseAuth);
  };

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      authError,
      userEmail,
      userRole,
      isAccessActive,
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
      userPermissions,
      register,
    ],
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
