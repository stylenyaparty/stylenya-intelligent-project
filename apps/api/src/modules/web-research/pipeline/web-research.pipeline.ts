import type {
    PipelineCluster,
    PipelineResult,
    PipelineRow,
    WebResearchInput,
    WebResearchProvider,
} from "../web-research.types";

function toDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function domainFor(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "unknown";
    }
}

export async function runWebResearchPipeline(
    input: WebResearchInput,
    provider: WebResearchProvider
): Promise<PipelineResult> {
    const startedAt = Date.now();
    const docs = await provider.search(input);
    const providerMs = Date.now() - startedAt;

    const deduped = new Map<string, (typeof docs)[number]>();
    for (const doc of docs) {
        if (!deduped.has(doc.url)) deduped.set(doc.url, doc);
    }

    const rows: PipelineRow[] = Array.from(deduped.values()).map((doc) => {
        const clusterKey = domainFor(doc.url);
        const score = typeof doc.score === "number" ? doc.score : 0;
        return {
            url: doc.url,
            title: doc.title,
            snippet: doc.snippet,
            publishedAt: toDate(doc.publishedAt),
            score,
            clusterKey,
            rawJson: doc.raw,
            evidences: [
                {
                    url: doc.url,
                    title: doc.title,
                    snippet: doc.snippet,
                    publishedAt: toDate(doc.publishedAt),
                    source: "tavily",
                    rawJson: doc.raw,
                },
            ],
        };
    });

    const rowsByCluster = new Map<string, PipelineRow[]>();
    for (const row of rows) {
        const clusterRows = rowsByCluster.get(row.clusterKey) ?? [];
        clusterRows.push(row);
        rowsByCluster.set(row.clusterKey, clusterRows);
    }

    const clusters: PipelineCluster[] = Array.from(rowsByCluster.entries())
        .map(([key, clusterRows]) => ({
            key,
            label: key,
            summary: `${clusterRows.length} result(s) from ${key}`,
            rank: 0,
            rowCount: clusterRows.length,
            topScore: Math.max(...clusterRows.map((row) => row.score ?? 0)),
            bundleJson: {
                urls: clusterRows.slice(0, 3).map((row) => row.url),
            },
        }))
        .sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0) || b.rowCount - a.rowCount)
        .map((cluster, index) => ({ ...cluster, rank: index + 1 }));

    const rowsWithRank = rows.map((row) => ({
        ...row,
        clusterRank: clusters.find((cluster) => cluster.key === row.clusterKey)?.rank,
    }));

    const topSources = rowsWithRank.slice(0, 5).map((row) => ({ url: row.url, title: row.title }));

    return {
        rows: rowsWithRank,
        clusters,
        resultBundle: {
            title: `Web research: ${input.query}`,
            summary: clusters.length
                ? `Found ${rowsWithRank.length} sources across ${clusters.length} cluster(s).`
                : "No results were found.",
            nextSteps: clusters.slice(0, 3).map((cluster) => `Review cluster ${cluster.label}`),
            sources: topSources,
        },
        timingsMs: {
            provider: providerMs,
            total: Date.now() - startedAt,
        },
    };
}
