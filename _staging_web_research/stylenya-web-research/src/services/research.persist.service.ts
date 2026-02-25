import { prisma } from "../db/prisma.js";

type AnyRow = Record<string, any>;

type AnyCluster = Record<string, any>;

type PersistableCluster = {
    key: string;
    label: string;
    rank: number | null;
    rowCount: number;
    topScore: number | null;
    summary: string | null;
    bundleJson: unknown;
};

function normalizeKey(value: string) {
    const cleaned = value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return cleaned || "uncategorized";
}

function toDate(value: unknown): Date | null {
    if (!value || typeof value !== "string") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function resolveEvidenceList(row: AnyRow): any[] {
    const candidates = [row?.evidences, row?.evidence, row?.evidenceItems, row?.evidenceList, row?.topEvidence];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }

    return [];
}

function resolveRowUrl(row: AnyRow, index: number) {
    if (typeof row?.url === "string" && row.url.trim()) return row.url.trim();

    const evidences = resolveEvidenceList(row);
    const firstEvidenceUrl = evidences.find((item) => typeof item?.url === "string" && item.url.trim())?.url;
    if (firstEvidenceUrl) return String(firstEvidenceUrl).trim();

    const rowId = typeof row?.rowId === "string" && row.rowId.trim() ? row.rowId.trim() : `row-${index + 1}`;
    return `internal://${normalizeKey(rowId)}`;
}

export async function persistRowsAndEvidence(runId: string, rows: AnyRow[]) {
    const persistedRows: Array<{ id: string; row: AnyRow }> = [];

    for (let index = 0; index < (rows ?? []).length; index++) {
        const row = rows[index] ?? {};
        const url = resolveRowUrl(row, index);

        const persistedRow = await prisma.researchRow.upsert({
            where: {
                runId_url: {
                    runId,
                    url,
                },
            },
            create: {
                runId,
                url,
                title: String(row?.keyword ?? row?.title ?? row?.cluster ?? `Research row ${index + 1}`),
                snippet: typeof row?.snippet === "string" ? row.snippet : null,
                publishedAt: toDate(row?.publishedAt),
                score: typeof row?.researchScore === "number" ? row.researchScore : null,
                clusterKey: normalizeKey(String(row?.clusterKey ?? row?.cluster ?? "uncategorized")),
                clusterRank: typeof row?.rank === "number" ? row.rank : null,
                rawJson: row,
            },
            update: {
                title: String(row?.keyword ?? row?.title ?? row?.cluster ?? `Research row ${index + 1}`),
                snippet: typeof row?.snippet === "string" ? row.snippet : null,
                publishedAt: toDate(row?.publishedAt),
                score: typeof row?.researchScore === "number" ? row.researchScore : null,
                clusterKey: normalizeKey(String(row?.clusterKey ?? row?.cluster ?? "uncategorized")),
                clusterRank: typeof row?.rank === "number" ? row.rank : null,
                rawJson: row,
            },
        });

        persistedRows.push({ id: persistedRow.id, row });

        const evidences = resolveEvidenceList(row);

        for (const evidence of evidences) {
            const evidenceUrl = typeof evidence?.url === "string" ? evidence.url.trim() : "";
            if (!evidenceUrl) continue;

            await prisma.researchEvidence.upsert({
                where: {
                    rowId_url: {
                        rowId: persistedRow.id,
                        url: evidenceUrl,
                    },
                },
                create: {
                    rowId: persistedRow.id,
                    url: evidenceUrl,
                    title: typeof evidence?.title === "string" ? evidence.title : null,
                    snippet: typeof evidence?.snippet === "string" ? evidence.snippet : null,
                    publishedAt: toDate(evidence?.publishedAt),
                    source: typeof evidence?.domain === "string" ? evidence.domain : null,
                    rawJson: evidence,
                },
                update: {
                    title: typeof evidence?.title === "string" ? evidence.title : null,
                    snippet: typeof evidence?.snippet === "string" ? evidence.snippet : null,
                    publishedAt: toDate(evidence?.publishedAt),
                    source: typeof evidence?.domain === "string" ? evidence.domain : null,
                    rawJson: evidence,
                },
            });
        }
    }

    return persistedRows;
}

export function backfillClustersFromRows(rows: AnyRow[], maxClusters = 7): PersistableCluster[] {
    const grouped = new Map<string, AnyRow[]>();

    for (const row of rows ?? []) {
        const label = String(row?.clusterKey ?? row?.cluster ?? "uncategorized").trim() || "uncategorized";
        const key = normalizeKey(label);
        const group = grouped.get(key) ?? [];
        group.push(row);
        grouped.set(key, group);
    }

    return Array.from(grouped.entries())
        .map(([key, group]) => {
            const topScore = group.reduce((max, row) => {
                const score = typeof row?.researchScore === "number" ? row.researchScore : 0;
                return Math.max(max, score);
            }, 0);

            return {
                key,
                label: String(group[0]?.cluster ?? group[0]?.clusterKey ?? "uncategorized"),
                rank: null,
                rowCount: group.length,
                topScore,
                summary: null,
                bundleJson: {
                    source: "backfillClustersFromRows",
                    rows: group,
                },
            };
        })
        .sort((a, b) => b.topScore - a.topScore)
        .slice(0, maxClusters)
        .map((cluster, index) => ({ ...cluster, rank: index + 1 }));
}

export async function persistClusters(runId: string, clusterBundles: AnyCluster[] | undefined, rows: AnyRow[]) {
    const shouldBackfill = !Array.isArray(clusterBundles) || clusterBundles.length < 1;
    const sourceClusters: PersistableCluster[] = shouldBackfill
        ? backfillClustersFromRows(rows, 7)
        : clusterBundles.map((cluster, index): PersistableCluster => {
            const label = String(cluster?.cluster ?? cluster?.label ?? `cluster-${index + 1}`).trim();
            const key = normalizeKey(String(cluster?.key ?? label));
            const rowCount = Array.isArray(rows)
                ? rows.filter((row) => normalizeKey(String(row?.clusterKey ?? row?.cluster ?? "uncategorized")) === key).length
                : 0;
            const topScore = Array.isArray(rows)
                ? rows
                      .filter((row) => normalizeKey(String(row?.clusterKey ?? row?.cluster ?? "uncategorized")) === key)
                      .reduce((max, row) => Math.max(max, typeof row?.researchScore === "number" ? row.researchScore : 0), 0)
                : null;

            return {
                key,
                label: label || "uncategorized",
                rank: index + 1,
                rowCount,
                topScore,
                summary: typeof cluster?.summary === "string" ? cluster.summary : null,
                bundleJson: cluster,
            };
        });

    const finalClusters = sourceClusters
        .sort((a, b) => (b.topScore ?? 0) - (a.topScore ?? 0))
        .slice(0, 7)
        .map((cluster, index) => ({ ...cluster, rank: index + 1 }));

    for (const cluster of finalClusters) {
        await prisma.researchCluster.upsert({
            where: {
                runId_key: {
                    runId,
                    key: cluster.key,
                },
            },
            create: {
                runId,
                key: cluster.key,
                label: cluster.label,
                summary: cluster.summary,
                rank: cluster.rank,
                rowCount: cluster.rowCount,
                topScore: cluster.topScore,
                bundleJson: cluster.bundleJson,
            },
            update: {
                label: cluster.label,
                summary: cluster.summary,
                rank: cluster.rank,
                rowCount: cluster.rowCount,
                topScore: cluster.topScore,
                bundleJson: cluster.bundleJson,
            },
        });
    }
}
