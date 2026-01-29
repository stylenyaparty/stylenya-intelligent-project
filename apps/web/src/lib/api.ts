type ApiError = { error?: string; message?: string };

function getToken(): string | null {
    // Ajusta si tu useAuth lo guarda con otro key
    return localStorage.getItem("token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();

    const res = await fetch(path, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        let body: ApiError | null = null;
        try {
            body = await res.json();
        } catch {
            // ignore JSON parse errors
        }
        const msg = body?.error || body?.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return res.json() as Promise<T>;
}
