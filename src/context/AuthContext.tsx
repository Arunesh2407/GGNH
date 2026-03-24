import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const AUTH_STORAGE_KEY = "ggnh_admin_session";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getInitialAuth = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "active";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] =
    useState<boolean>(getInitialAuth);

  const login = (username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase();
    const isValid =
      normalizedUsername === ADMIN_USERNAME && password === ADMIN_PASSWORD;

    if (!isValid) {
      return false;
    }

    setIsAuthenticated(true);
    window.localStorage.setItem(AUTH_STORAGE_KEY, "active");
    return true;
  };

  const logout = () => {
    setIsAuthenticated(false);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      isAuthenticated,
      login,
      logout,
    }),
    [isAuthenticated],
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
