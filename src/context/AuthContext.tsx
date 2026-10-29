
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateProfileName,
} from "../api/auth";

import type { AuthUser } from "../api/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<void>;

  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  updateProfile: (
    name: string
  ) => Promise<void>;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  async function login(
    email: string,
    password: string
  ) {
    const authenticatedUser = await loginUser(
      email,
      password
    );

    setUser(authenticatedUser);
  }

  async function register(
    name: string,
    email: string,
    password: string
  ) {
    await registerUser(name, email, password);

    // Registration creates a user, then logs them in.
    await login(email, password);
  }

  async function logout() {
    await logoutUser();
    setUser(null);
  }

  async function updateProfile(name: string) {
    const updatedUser = await updateProfileName(name);

    // Update React state without requiring a refresh.
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
}
