import crypto from "crypto";
import { memoryCache } from "../cache/memory.cache.js";

type TavilySearchOptions = {
    query: string;
    maxResults: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    searchDepth?: "basic" | "advanced";
    mode?: "quick" | "deep";
    locale?: string;
    geo?: string;
    language?: string;
};

export type TavilyResult = {
    url: string;
    title?: string;
    content?: string;
    score?: number;
    published_date?: string;
};

type TavilyResponse = {
    results?: TavilyResult[];
    answer?: string;
    query?: string;
    error?: string;
    message?: string;
};

const DEFAULT_TTL_MS = 21_600_000;

function getCacheConfig() {
    return {
        enabled: String(process.env.TAVILY_CACHE_ENABLED ?? "false").toLowerCase() === "true",
        ttlMs: Number(process.env.TAVILY_CACHE_TTL_MS ?? DEFAULT_TTL_MS),
    };
}

function buildCacheKey(opts: TavilySearchOptions) {
    return crypto
        .createHash("sha256")
        .update(
            JSON.stringify({
                query: opts.query,
                mode: opts.mode ?? "quick",
                locale: opts.locale ?? "",
                geo: opts.geo ?? "",
                language: opts.language ?? "",
            })
        )
        .digest("hex");
}

export async function tavilySearchWithMeta(opts: TavilySearchOptions): Promise<{ results: TavilyResult[]; cacheHit: boolean }> {
    const cacheConfig = getCacheConfig();
    const cacheKey = buildCacheKey(opts);

    if (cacheConfig.enabled) {
        const cached = memoryCache.get<TavilyResult[]>(cacheKey);
        if (cached) {
            return { results: cached, cacheHit: true };
        }
    }

    const key = process.env.TAVILY_API_KEY;

    if (!key) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[tavily] Missing TAVILY_API_KEY (dev mode) -> returning []");
            return { results: [], cacheHit: false };
        }
        throw new Error("Missing TAVILY_API_KEY in environment.");
    }

    const body: any = {
        api_key: key,
        query: opts.query,
        max_results: opts.maxResults,
        search_depth: opts.searchDepth ?? "basic",
        include_answer: false,
        include_raw_content: false,
    };

    if (opts.includeDomains?.length) body.include_domains = opts.includeDomains;
    if (opts.excludeDomains?.length) body.exclude_domains = opts.excludeDomains;

    let res: Response;
    try {
        res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : `Non-Error thrown: ${String(e)}`;
        throw new Error(`[tavily] Network/fetch error: ${msg}`);
    }

    const txt = await res.text();

    if (!res.ok) {
        throw new Error(`Tavily search failed (${res.status}): ${txt.slice(0, 500)}`);
    }

    let data: TavilyResponse;
    try {
        data = JSON.parse(txt) as TavilyResponse;
    } catch {
        throw new Error(`Tavily returned non-JSON body (first 300): ${txt.slice(0, 300)}`);
    }

    if (data?.error) {
        throw new Error(`Tavily error (200): ${String(data.error).slice(0, 500)}`);
    }

    const results = data?.results ?? [];

    if (cacheConfig.enabled) {
        memoryCache.set(cacheKey, results, cacheConfig.ttlMs);
    }

    return { results, cacheHit: false };
}

export async function tavilySearch(opts: TavilySearchOptions): Promise<TavilyResult[]> {
    const data = await tavilySearchWithMeta(opts);
    return data.results;
}
