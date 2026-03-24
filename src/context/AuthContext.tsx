import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setIsLoading(false);
      setAuthError(
        "Firebase is not configured. Add Firebase env variables to enable admin login.",
      );
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setIsAuthenticated(Boolean(user));
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
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setAuthError("");
      return true;
    } catch (error) {
      setAuthError("Invalid email or password.");
      return false;
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
      login,
      logout,
    }),
    [isAuthenticated, isLoading, authError],
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
