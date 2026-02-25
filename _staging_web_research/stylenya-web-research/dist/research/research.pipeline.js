import { tavilySearch } from "../providers/tavily.client.js";
import { getOpenAIClient } from "../providers/openai.client.js";
import { buildResearchPrompt } from "./prompt.builder.js";
import { scoreAndSortRows } from "./scoring.js";
import { addClusterRank } from "./ranking.js";
import { researchOutputSchema } from "./research.output.schema.js";
const MIN_ROWS_DEEP = 15;
const MIN_CLUSTERS_DEEP = 3;
function needsExpansion(json, input, evidenceCount) {
    if (evidenceCount <= 0)
        return false;
    if (input.mode !== "deep")
        return false;
    const rowsLen = Array.isArray(json?.rows) ? json.rows.length : 0;
    const clustersLen = Array.isArray(json?.clusterBundles) ? json.clusterBundles.length : 0;
    return rowsLen < MIN_ROWS_DEEP || clustersLen < MIN_CLUSTERS_DEEP;
}
function truncate(s, max = 500) {
    const clean = (s ?? "").replace(/\s+/g, " ").trim();
    return clean.length > max ? clean.slice(0, max) + "…" : clean;
}
function capEvidenceByDomain(items, maxTotal, maxPerDomain) {
    const byDomain = new Map();
    for (const it of items) {
        const arr = byDomain.get(it.domain) ?? [];
        arr.push(it);
        byDomain.set(it.domain, arr);
    }
    const domains = Array.from(byDomain.keys());
    const out = [];
    let i = 0;
    while (out.length < maxTotal && domains.length > 0) {
        const idx = i % domains.length;
        const d = domains[idx];
        const arr = byDomain.get(d);
        const usedForDomain = out.filter((x) => x.domain === d).length;
        if (usedForDomain >= maxPerDomain || arr.length === 0) {
            domains.splice(idx, 1);
            if (domains.length === 0)
                break;
            continue;
        }
        out.push(arr.shift());
        i++;
    }
    return out;
}
function deriveClusterBundlesFromRows(rows, maxClusters) {
    const byCluster = new Map();
    for (const r of rows ?? []) {
        const c = typeof r?.cluster === "string" && r.cluster.trim() ? r.cluster.trim() : "Unclustered";
        const arr = byCluster.get(c) ?? [];
        arr.push(r);
        byCluster.set(c, arr);
    }
    // ordena clusters por volumen (mentions) y tamaño
    const clusters = Array.from(byCluster.entries())
        .map(([cluster, items]) => {
        const totalMentions = items.reduce((sum, x) => sum + (Number(x?.mentions) || 0), 0);
        return { cluster, items, totalMentions };
    })
        .sort((a, b) => (b.totalMentions - a.totalMentions) || (b.items.length - a.items.length))
        .slice(0, maxClusters);
    return clusters.map(({ cluster, items }) => {
        const topKeywords = items
            .map((x) => x?.keyword)
            .filter(Boolean)
            .slice(0, 5);
        const recommendedActions = items
            .flatMap((x) => (Array.isArray(x?.recommendedActions) ? x.recommendedActions : []))
            .slice(0, 3) ?? [];
        // Si no hay acciones a nivel row, mete una acción genérica
        const actions = recommendedActions.length > 0
            ? recommendedActions
            : [{ title: `Create Etsy/Shopify listing SEO set for: ${cluster}`, priority: "P1" }];
        // recoge evidencia desde rows
        const topEvidence = items
            .flatMap((x) => (Array.isArray(x?.topEvidence) ? x.topEvidence : []))
            .filter((e) => e?.url && e?.title)
            .slice(0, 2)
            .map((e) => ({ url: e.url, title: e.title }));
        return {
            cluster,
            topKeywords,
            recommendedActions: actions.map((a) => ({
                title: String(a.title ?? "").trim() || `Create SEO content for ${cluster}`,
                priority: (a.priority === "P0" || a.priority === "P1" || a.priority === "P2") ? a.priority : "P1",
            })),
            topEvidence,
        };
    });
}
function buildResultBundle(json, prompt) {
    const topClusters = (json.clusterBundles ?? []).slice(0, 3);
    const title = `Web Research: ${prompt}`;
    const summary = topClusters
        .map((c) => `• ${c.cluster}: ${(c.topKeywords ?? []).slice(0, 3).join(", ")}`)
        .join("\n");
    const safeSummary = summary.trim().length > 0
        ? summary
        : "No strong clusters were found from the provided evidence.";
    const nextSteps = topClusters
        .flatMap((c) => (c.recommendedActions ?? []).map((a) => a.title))
        .slice(0, 5);
    const sources = topClusters
        .flatMap((c) => c.topEvidence ?? [])
        .slice(0, 5)
        .map((e) => ({
        url: e.url,
        title: e.title,
    }));
    return {
        title,
        summary: safeSummary,
        nextSteps,
        sources,
    };
}
function backfillClusterBundlesFromRows(rows, maxClusters) {
    const by = new Map();
    for (const r of rows ?? []) {
        const c = String(r?.cluster ?? "").trim() || "General";
        const arr = by.get(c) ?? [];
        arr.push(r);
        by.set(c, arr);
    }
    return Array.from(by.entries())
        .sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0))
        .slice(0, maxClusters)
        .map(([cluster, items]) => ({
        cluster,
        topKeywords: items.map((x) => x.keyword).filter(Boolean).slice(0, 5),
        recommendedActions: [{ title: `Create SEO set for: ${cluster}`, priority: "P1" }],
        topEvidence: items
            .flatMap((x) => x.topEvidence ?? [])
            .filter((e) => e?.url && e?.title)
            .slice(0, 2)
            .map((e) => ({ url: e.url, title: e.title })),
    }));
}
async function callLLMJson(prompt, temperature) {
    const client = getOpenAIClient();
    const resp = await client.responses.create({
        model: "gpt-4o-mini",
        input: [{ role: "user", content: prompt }],
        temperature,
    });
    return String(resp.output_text ?? "").trim();
}
export async function runResearchPipeline(input) {
    const nowIso = new Date().toISOString();
    const plan = input.mode === "deep"
        ? { maxResultsPerQuery: 10, searchDepth: "advanced" }
        : { maxResultsPerQuery: 8, searchDepth: "basic" };
    const base = input.prompt.trim();
    const queries = input.mode === "deep"
        ? [
            `${base} party decorations trends themes 2026 ${input.market}`,
            `${base} party decor best sellers Etsy keywords ${input.market}`,
        ]
        : [`${base} party decorations trends ${input.market}`];
    const allResults = await Promise.all(queries.map((q) => tavilySearch({
        query: q,
        maxResults: plan.maxResultsPerQuery,
        searchDepth: plan.searchDepth,
    })));
    const perQueryCounts = allResults.map((arr) => arr?.length ?? 0);
    console.log("[webResearch] queries:", queries.length, perQueryCounts);
    const evidence = [];
    for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        for (const r of allResults[i] ?? []) {
            try {
                const u = new URL(r.url);
                evidence.push({
                    url: r.url,
                    title: truncate(r.title ?? u.hostname, 140),
                    snippet: truncate(r.content ?? "", 500),
                    publishedAt: r.published_date ?? null,
                    capturedAt: nowIso,
                    domain: u.hostname,
                    query: q,
                });
            }
            catch {
                // ignore invalid URLs
            }
        }
    }
    console.log("[webResearch] evidence raw:", evidence.length);
    // CAPPING: reduce costo/ruido
    // Deep: allow a bit more diversity and slightly higher per-domain cap.
    const evidenceCap = input.mode === "deep" ? 25 : 10;
    const maxPerDomain = input.mode === "deep" ? 4 : 3;
    const evidenceCapped = capEvidenceByDomain(evidence, evidenceCap, maxPerDomain);
    console.log("[webResearch] evidence capped:", evidenceCapped.length);
    const language = input.language ?? "en";
    const promptInput = {
        prompt: input.prompt,
        mode: input.mode,
        market: input.market,
        language,
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        evidence: evidenceCapped.map((e) => ({
            url: e.url,
            domain: e.domain,
            title: e.title,
            snippet: e.snippet,
            publishedAt: e.publishedAt,
            query: e.query,
        })),
    };
    const prompt = buildResearchPrompt(promptInput) ?? "";
    console.log("[webResearch] prompt head:", prompt.slice(0, 180));
    const baseTemp = input.mode === "deep" ? 0.15 : 0.2;
    const tryParse = (raw) => {
        try {
            const obj = JSON.parse(raw);
            const parsed = researchOutputSchema.safeParse(obj);
            if (!parsed.success)
                return { ok: false, error: parsed.error, obj: null };
            return { ok: true, obj: parsed.data };
        }
        catch (e) {
            return { ok: false, error: e, obj: null };
        }
    };
    const ensureNonEmpty = (v, fallback) => typeof v === "string" && v.trim().length > 0 ? v : fallback;
    const hardenResultBundle = (json) => {
        if (!json.resultBundle || typeof json.resultBundle !== "object") {
            json.resultBundle = {
                title: `Web Research: ${input.prompt}`,
                summary: "Summary unavailable due to insufficient structured output.",
                nextSteps: [],
                sources: [],
            };
            return;
        }
        json.resultBundle.title = ensureNonEmpty(json.resultBundle.title, `Web Research: ${input.prompt}`);
        json.resultBundle.summary = ensureNonEmpty(json.resultBundle.summary, "Summary unavailable due to insufficient structured output.");
        if (!Array.isArray(json.resultBundle.nextSteps))
            json.resultBundle.nextSteps = [];
        if (!Array.isArray(json.resultBundle.sources))
            json.resultBundle.sources = [];
    };
    // 1st attempt
    const raw1 = await callLLMJson(prompt, baseTemp);
    const p1 = tryParse(raw1);
    if (p1.ok) {
        let json = p1.obj;
        // Always harden first (then compute/overwrite)
        hardenResultBundle(json);
        json.rows = scoreAndSortRows(json.rows);
        json.rows = addClusterRank(json.rows);
        // Backfill clusters deterministically (deep only) BEFORE deciding expansion
        if (input.mode === "deep") {
            const bundlesLen = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
            if (bundlesLen < MIN_CLUSTERS_DEEP) {
                console.log("[webResearch] backfill clusterBundles from rows");
                json.clusterBundles = backfillClusterBundlesFromRows(json.rows, 7);
            }
        }
        // Build bundle after backfill
        json.resultBundle = buildResultBundle(json, input.prompt);
        // Expansion: only if still under the row minimum in deep mode (clusters are handled by backfill)
        const shouldExpand = input.mode === "deep" &&
            evidenceCapped.length > 0 &&
            (Array.isArray(json.rows) ? json.rows.length : 0) < MIN_ROWS_DEEP;
        if (shouldExpand) {
            console.log("[webResearch] expansion triggered");
            // Keep expansion prompt SMALL (no full JSON echo)
            const rowCount = Array.isArray(json.rows) ? json.rows.length : 0;
            const clusterCount = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
            const expandPrompt = prompt +
                "\n\nEXPANSION REQUIRED.\n" +
                `- Current rows: ${rowCount} (minimum ${MIN_ROWS_DEEP})\n` +
                `- Current clusterBundles: ${clusterCount} (minimum ${MIN_CLUSTERS_DEEP})\n\n` +
                "Fix it by EXPANDING the output using ONLY the provided evidence.\n" +
                "- Deep mode MUST produce at least the minimum rows when evidence is non-empty.\n" +
                "- Keep clusters meaningful and distribute keywords across them.\n" +
                "- Keep all fields valid per schema.\n" +
                "- Keep resultBundle.summary non-empty.\n" +
                "Return ONLY the full corrected JSON.";
            const rawX = await callLLMJson(expandPrompt, 0);
            const px = tryParse(rawX);
            if (px.ok) {
                json = px.obj;
                hardenResultBundle(json);
                json.rows = scoreAndSortRows(json.rows);
                json.rows = addClusterRank(json.rows);
                // Backfill again if model still underclusters
                if (input.mode === "deep") {
                    const bundlesLen = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
                    if (bundlesLen < MIN_CLUSTERS_DEEP) {
                        console.log("[webResearch] backfill clusterBundles from rows (post-expand)");
                        json.clusterBundles = backfillClusterBundlesFromRows(json.rows, 7);
                    }
                }
                json.resultBundle = buildResultBundle(json, input.prompt);
            }
            else {
                console.warn("[webResearch] expansion parse failed");
            }
        }
        // Final harden (in case buildResultBundle or model output left blanks)
        hardenResultBundle(json);
        return json;
    }
    // Retry 1 vez (repair) — NO Tavily, solo re-formateo
    const repairPrompt = prompt +
        "\n\nIMPORTANT: Your previous output was invalid. Return ONLY valid JSON matching the exact schema. Do not include any extra text.";
    const raw2 = await callLLMJson(repairPrompt, 0);
    const p2 = tryParse(raw2);
    if (p2.ok) {
        let json = p2.obj;
        hardenResultBundle(json);
        json.rows = scoreAndSortRows(json.rows);
        json.rows = addClusterRank(json.rows);
        // Backfill clusters deterministically (deep only) BEFORE deciding expansion
        if (input.mode === "deep") {
            const bundlesLen = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
            if (bundlesLen < MIN_CLUSTERS_DEEP) {
                console.log("[webResearch] backfill clusterBundles from rows");
                json.clusterBundles = backfillClusterBundlesFromRows(json.rows, 7);
            }
        }
        json.resultBundle = buildResultBundle(json, input.prompt);
        // Expansion: only if still under the row minimum in deep mode
        const shouldExpand = input.mode === "deep" &&
            evidenceCapped.length > 0 &&
            (Array.isArray(json.rows) ? json.rows.length : 0) < MIN_ROWS_DEEP;
        if (shouldExpand) {
            console.log("[webResearch] expansion triggered after repair");
            const rowCount = Array.isArray(json.rows) ? json.rows.length : 0;
            const clusterCount = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
            const expandPrompt = prompt +
                "\n\nEXPANSION REQUIRED.\n" +
                `- Current rows: ${rowCount} (minimum ${MIN_ROWS_DEEP})\n` +
                `- Current clusterBundles: ${clusterCount} (minimum ${MIN_CLUSTERS_DEEP})\n\n` +
                "Fix it by EXPANDING the output using ONLY the provided evidence.\n" +
                "- Deep mode MUST produce at least the minimum rows when evidence is non-empty.\n" +
                "- Keep clusters meaningful and distribute keywords across them.\n" +
                "- Keep all fields valid per schema.\n" +
                "- Keep resultBundle.summary non-empty.\n" +
                "Return ONLY the full corrected JSON.";
            const rawX = await callLLMJson(expandPrompt, 0);
            const px = tryParse(rawX);
            if (px.ok) {
                json = px.obj;
                hardenResultBundle(json);
                json.rows = scoreAndSortRows(json.rows);
                json.rows = addClusterRank(json.rows);
                if (input.mode === "deep") {
                    const bundlesLen = Array.isArray(json.clusterBundles) ? json.clusterBundles.length : 0;
                    if (bundlesLen < MIN_CLUSTERS_DEEP) {
                        console.log("[webResearch] backfill clusterBundles from rows (post-expand)");
                        json.clusterBundles = backfillClusterBundlesFromRows(json.rows, 7);
                    }
                }
                json.resultBundle = buildResultBundle(json, input.prompt);
            }
            else {
                console.warn("[webResearch] expansion parse failed after repair");
            }
        }
        hardenResultBundle(json);
        return json;
    }
    console.error("LLM invalid output after retry (first 300 chars):", raw2.slice(0, 300));
    // Fallback must satisfy schema expectations; keep resultBundle non-empty
    return {
        rows: [],
        clusterBundles: [],
        resultBundle: {
            title: `Web Research: ${input.prompt}`,
            summary: "No usable structured output was produced from the provided evidence.",
            nextSteps: [],
            sources: [],
        },
    };
}
//# sourceMappingURL=research.pipeline.js.map