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

export type KeywordProviderSettings = {
  trends: { enabled: boolean };
  googleAds: { enabled: boolean; configured: boolean; customerId?: string };
  auto: { prefers: string };
};

export type GoogleAdsSettingsPayload = {
  enabled: boolean;
  customerId?: string;
  developerToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

export async function getKeywordProviderSettings() {
  return api<KeywordProviderSettings>("/settings/keyword-providers");
}

export async function updateKeywordProviderSettings(payload: GoogleAdsSettingsPayload) {
  return api<{ ok: boolean; googleAds: KeywordProviderSettings["googleAds"] }>(
    "/settings/google-ads",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type LLMStatus = {
  ok: boolean;
  configured: boolean;
  provider: "openai" | "disabled";
  model?: string;
};

export type DecisionDraft = {
  id: string;
  createdDate: string;
  title: string;
  rationale: string;
  recommendedActions: string[];
  confidence?: number | null;
  status: "NEW" | "DISMISSED" | "PROMOTED";
  signalIds: string[];
  seedSet?: string[] | null;
  model?: string | null;
  usage?: unknown;
  promotedDecisionId?: string | null;
  createdAt: string;
};

export async function getLLMStatus() {
  return api<LLMStatus>("/llm/status");
}

export async function generateDecisionDrafts(input: {
  batchId?: string;
  signalIds?: string[];
  seeds?: string[];
  context?: string;
}) {
  return api<{ ok: boolean; drafts: DecisionDraft[] }>("/decision-drafts/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listDecisionDrafts(params: { date?: string; status?: "NEW" | "DISMISSED" | "PROMOTED" | "ALL" } = {}) {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return api<{ ok: boolean; drafts: DecisionDraft[] }>(
    `/decision-drafts${suffix ? `?${suffix}` : ""}`,
  );
}

export async function dismissDraft(draftId: string) {
  return api<{ ok: boolean; draft: DecisionDraft }>(`/decision-drafts/${draftId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function promoteDraft(draftId: string) {
  return api<{ ok: boolean; draft: DecisionDraft; decision: { id: string } }>(
    `/decision-drafts/${draftId}/promote`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}
