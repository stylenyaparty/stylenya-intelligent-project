export async function tavilySearch(opts) {
    const key = process.env.TAVILY_API_KEY;
    // --- ENV DIAGNOSTICS ---
    const keyPresent = Boolean(key && key.trim().length > 0);
    const keyTail = keyPresent ? key.slice(-6) : "none";
    console.log("[tavily] env:", {
        keyPresent,
        keyTail,
        nodeEnv: process.env.NODE_ENV ?? "undefined",
    });
    if (!key) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[tavily] Missing TAVILY_API_KEY (dev mode) -> returning []");
            return [];
        }
        throw new Error("Missing TAVILY_API_KEY in environment.");
    }
    // --- REQUEST BUILD ---
    const body = {
        api_key: key,
        query: opts.query,
        max_results: opts.maxResults,
        search_depth: opts.searchDepth ?? "basic",
        include_answer: false,
        include_raw_content: false,
    };
    if (opts.includeDomains?.length)
        body.include_domains = opts.includeDomains;
    if (opts.excludeDomains?.length)
        body.exclude_domains = opts.excludeDomains;
    console.log("[tavily] request:", {
        query: opts.query,
        max_results: body.max_results,
        search_depth: body.search_depth,
        include_domains: body.include_domains?.length ?? 0,
        exclude_domains: body.exclude_domains?.length ?? 0,
    });
    // --- FETCH ---
    let res;
    try {
        res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }
    catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : `Non-Error thrown: ${String(e)}`;
        throw new Error(`[tavily] Network/fetch error: ${msg}`);
    }
    const txt = await res.text(); // leer UNA sola vez (consume el stream)
    console.log("[tavily] response:", {
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get("content-type") ?? "unknown",
        bodyFirst300: txt.slice(0, 300),
    });
    if (!res.ok) {
        // devuelve el cuerpo para diagnosticar 401/403/429/400, etc.
        throw new Error(`Tavily search failed (${res.status}): ${txt.slice(0, 500)}`);
    }
    // --- PARSE JSON ---
    let data;
    try {
        data = JSON.parse(txt);
    }
    catch {
        throw new Error(`Tavily returned non-JSON body (first 300): ${txt.slice(0, 300)}`);
    }
    // --- API-LEVEL ERRORS (sometimes returned with 200) ---
    if (data?.error) {
        throw new Error(`Tavily error (200): ${String(data.error).slice(0, 500)}`);
    }
    if (data?.message && !data?.results) {
        console.warn("[tavily] message without results:", String(data.message).slice(0, 300));
    }
    const results = data?.results ?? [];
    console.log("[tavily] results:", {
        count: results.length,
        sample: results.slice(0, 2).map((r) => ({
            url: r.url,
            title: r.title?.slice(0, 80),
            published_date: r.published_date ?? null,
            score: r.score ?? null,
        })),
    });
    return results;
}
//# sourceMappingURL=tavily.client.js.map