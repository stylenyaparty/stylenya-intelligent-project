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

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Source of truth: /v1/me (si token válido -> user; si no -> null)
  async function refreshMe() {
    try {
      const u = await fetchMe();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  // Hydration inicial
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
      // /login devuelve {id,email,role}; lo normalizamos a {sub,...}
      setUser({ sub: u.id, email: u.email, role: u.role });

      // Importante: validamos sesión contra /me (token + middleware)
      // Si algo falló con el token/header, esto lo detecta al instante.
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
