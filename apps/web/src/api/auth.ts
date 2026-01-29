const API_URL = import.meta.env.VITE_API_URL ?? "";

export type LoginUser = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
};

export type MeAuth = {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
};

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function login(email: string, password: string): Promise<LoginUser> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("API offline");
  }

  if (res.status === 401) throw new Error("Invalid credentials");

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Login failed (${res.status}) ${txt}`);
  }

  const data = await res.json();
  setToken(data.token);
  return data.user as LoginUser;
}

export async function fetchMe(): Promise<MeAuth> {
  const token = getToken();
  if (!token) throw new Error("No token");

  const res = await fetch(`${API_URL}/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ME failed (${res.status}) ${txt}`);
  }

  const data = await res.json();
  return data.auth as MeAuth;
}
