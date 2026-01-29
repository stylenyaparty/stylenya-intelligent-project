import React, { createContext, useEffect, useMemo, useState } from "react";
import { fetchMe, login as apiLogin, clearToken } from "../api/auth";

export type AuthUser = {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
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
      const u = await fetchMe();
      setUser(u);
    } catch {
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
      const u = await apiLogin(email, password);
      setUser({ sub: u.id, email: u.email, role: u.role });
      await refreshMe();
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
