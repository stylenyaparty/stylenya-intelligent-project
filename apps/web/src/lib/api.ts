type ApiErrorBody = { error?: string; message?: string; code?: string };

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const API_URL = import.meta.env.VITE_API_URL ?? "";

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await res.json();
    } catch {
      // ignore JSON parse errors
    }
    const msg = body?.message || body?.error || body?.code || `HTTP ${res.status}`;
    const code = body?.code || body?.error;
    throw new ApiError(msg, res.status, code);
  }

  // ✅ handle empty responses
  const text = await res.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}
