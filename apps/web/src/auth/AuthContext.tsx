import { createContext, useEffect, useState } from "react";
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
};

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password);
    // /login devuelve {id,email,role}; lo normalizamos a {sub,...}
    setUser({ sub: u.id, email: u.email, role: u.role });
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
