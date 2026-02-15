import React, { createContext, useEffect, useMemo, useState } from "react";
import { fetchMe, login as apiLogin, clearToken } from "../api/auth";

export type AuthUser = {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
  isReviewer?: boolean;
};

export type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const u = await fetchMe(); // <-- u es MeAuth {sub,email,role}
      setUser(u);
    } catch {
      // fetchMe ya hace clearToken() cuando es 401
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshMe();
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      await apiLogin(email, password); // guarda token en localStorage
      await refreshMe(); // valida y setea user desde /v1/me
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setLoading(false);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
