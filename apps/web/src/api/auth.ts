import { buildApiUrl } from "@/lib/api-url";

export type LoginUser = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
};

export type MeAuth = {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
  isReviewer?: boolean;
};

export type ReviewerSignupPayload = {
  code: string;
  name?: string;
  email: string;
  password: string;
};

export type BootstrapStatus = {
  usersCount: number;
  bootstrapRequired?: boolean;
};

export type InitialAdminPayload = {
  name: string;
  email: string;
  password: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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
    res = await fetch(buildApiUrl("/auth/login"), {
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

  const res = await fetch(buildApiUrl("/me"), {
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

export async function reviewerSignup(payload: ReviewerSignupPayload): Promise<{ id: string; email: string; name: string | null }> {
  const res = await fetch(buildApiUrl("/auth/reviewer/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new ApiError(txt || "Reviewer signup failed", res.status);
  }

  const data = await res.json();
  return data.user as { id: string; email: string; name: string | null };
}

export async function endReviewerAccess(): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("No token");

  const res = await fetch(buildApiUrl("/auth/reviewer/end"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new ApiError(txt || "End review failed", res.status);
  }
}

export async function fetchBootstrapStatus(): Promise<BootstrapStatus> {
  let res: Response;

  try {
    res = await fetch(buildApiUrl("/bootstrap-status"));
  } catch {
    throw new Error("Backend not reachable");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const message = `Bootstrap status failed (${res.status}) ${txt}`.trim();
    throw new ApiError(message, res.status);
  }

  const data = await res.json();

  return {
    usersCount: data.usersCount ?? data.userCount ?? 0,
    bootstrapRequired: data.bootstrapRequired ?? data.bootstrap_required ?? false,
  };
}

export async function createInitialAdmin(payload: InitialAdminPayload): Promise<void> {
  let res: Response;

  try {
    res = await fetch(buildApiUrl("/initial-admin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Backend not reachable");
  }

  if (res.status === 409) {
    throw new ApiError("Initial setup already completed", 409);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const message = `Setup failed (${res.status}) ${txt}`.trim();
    throw new ApiError(message, res.status);
  }
}
