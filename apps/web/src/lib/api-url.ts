function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function buildApiUrl(path: string): string {
  const rawBase = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/g, "");
  const prefix = normalizePrefix(import.meta.env.VITE_API_PREFIX ?? "/v1");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const baseHasPrefix =
    prefix.length > 0 && rawBase.toLowerCase().endsWith(prefix.toLowerCase());
  const base = `${rawBase}${baseHasPrefix ? "" : prefix}`;

  return `${base}${normalizedPath}`;
}
