import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { getActiveSeoContextSeeds } from "../settings/seo-context.service.js";
import { getActiveProductTypes } from "../settings/product-types.service.js";
import { parseGkpCsvBuffer } from "./gkp/gkpCsvParser.js";
import { buildProductTypeMatches, filterSignals } from "./relevance/seedRelevance.js";
import { computeSignalScore } from "./scoring/signalScoring.js";

type GkpImportResult = {
    ok: true;
    batch: {
        id: string;
        source: string;
        filename: string | null;
        status: string;
        totalRows: number;
        importedRows: number;
        skippedRows: number;
        warnings: string[];
        createdAt: Date;
    };
    importedRows: number;
    skippedRows: number;
    warnings: string[];
};

export async function importGkpCsv(buffer: Buffer, filename?: string | null): Promise<GkpImportResult> {
    const parsed = parseGkpCsvBuffer(buffer);
    if (parsed.rows.length === 0) {
        throw new AppError(400, "CSV_EMPTY", "No data rows found in CSV.");
    }

    const dedupe = new Map<string, Prisma.KeywordSignalCreateManyInput>();
    let skippedDuplicatesCount = 0;

    parsed.rows.forEach((row) => {
        const key = row.keywordNormalized;
        if (dedupe.has(key)) {
            skippedDuplicatesCount += 1;
            return;
        }

        const { score, reasons } = computeSignalScore({
            avgMonthlySearches: row.avgMonthlySearches,
            competitionLevel: row.competitionLevel,
            cpcHigh: row.cpcHigh,
            change3mPct: row.change3mPct,
            changeYoYPct: row.changeYoYPct,
        });

        dedupe.set(key, {
            keyword: row.keyword,
            keywordNormalized: row.keywordNormalized,
            source: "GKP_CSV",
            geo: row.geo ?? null,
            language: row.language ?? null,
            avgMonthlySearches: row.avgMonthlySearches ?? null,
            competitionLevel: row.competitionLevel ?? null,
            competitionIndex: row.competitionIndex ?? null,
            cpcLow: row.cpcLow ?? null,
            cpcHigh: row.cpcHigh ?? null,
            change3mPct: row.change3mPct ?? null,
            changeYoYPct: row.changeYoYPct ?? null,
            currency: row.currency ?? null,
            score,
            scoreReasons: reasons,
            monthlySearchesJson: row.monthlySearches ?? null,
            rawRowHash: row.rawRowHash,
            rawRow: row.rawRow,
        });
    });

    if (dedupe.size === 0) {
        throw new AppError(400, "CSV_NO_KEYWORDS", "No valid keyword rows found in CSV.");
    }

    const importedRows = dedupe.size;
    const skippedRows = parsed.skippedRows + skippedDuplicatesCount;
    const warnings = parsed.warnings;

    return prisma.$transaction(async (tx) => {
        const batch = await tx.signalBatch.create({
            data: {
                source: "GKP_CSV",
                filename: filename ?? null,
                status: "IMPORTED",
                totalRows: parsed.totalRows,
                importedRows,
                skippedRows,
                columnsDetected: parsed.columnsDetected,
                warningsJson: warnings,
                uploadedAt: new Date(),
            },
        });

        const data = Array.from(dedupe.values()).map((signal) => ({
            ...signal,
            batchId: batch.id,
        }));

        if (data.length > 0) {
            await tx.keywordSignal.createMany({ data });
        }

        return {
            ok: true,
            batch: {
                ...batch,
                warnings,
            },
            importedRows,
            skippedRows,
            warnings,
        };
    });
}

export async function listSignalBatches() {
    return prisma.signalBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
}

type SignalListFilters = {
    batchId?: string;
    source?: string;
    q?: string;
    sort?: "score" | "avgMonthlySearches" | "cpcHigh" | "createdAt" | "change3mPct" | "changeYoYPct";
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    relevanceMode?: "strict" | "broad" | "all";
};

export async function listSignals(filters: SignalListFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    const sortField = filters.sort ?? "score";
    const sortOrder = filters.order ?? "desc";

    const where: Prisma.KeywordSignalWhereInput = {};
    if (filters.batchId) {
        where.batchId = filters.batchId;
    }
    if (filters.source) {
        where.source = filters.source;
    }
    if (filters.q) {
        where.keyword = { contains: filters.q, mode: "insensitive" };
    }

    const orderBy: Prisma.KeywordSignalOrderByWithRelationInput[] = [
        { [sortField]: sortOrder } as Prisma.KeywordSignalOrderByWithRelationInput,
        { keyword: "asc" },
    ];

    const signals = await prisma.keywordSignal.findMany({
        where,
        orderBy,
        select: {
            id: true,
            batchId: true,
            keyword: true,
            avgMonthlySearches: true,
            competitionLevel: true,
            cpcLow: true,
            cpcHigh: true,
            change3mPct: true,
            changeYoYPct: true,
            currency: true,
            score: true,
            scoreReasons: true,
            createdAt: true,
            source: true,
        },
    });

    const relevanceMode = filters.relevanceMode ?? "strict";

    if (relevanceMode !== "all") {
        const [productTypes, { includeSeeds, excludeSeeds }] = await Promise.all([
            getActiveProductTypes(),
            getActiveSeoContextSeeds(),
        ]);
        const context = {
            productTypes: buildProductTypeMatches(productTypes),
            occasionTerms: includeSeeds,
            excludeTerms: excludeSeeds,
        };
        const { filteredSignals, filteredOutCount } = filterSignals(
            signals,
            context,
            relevanceMode
        );
        const sliced = filteredSignals.slice(offset, offset + limit);
        return { signals: sliced, filteredOutCount };
    }

    const sliced = signals.slice(offset, offset + limit);
    return { signals: sliced, filteredOutCount: 0 };
}

export async function listTopSignals(limit = 20) {
    return prisma.keywordSignal.findMany({
        orderBy: [{ avgMonthlySearches: "desc" }, { createdAt: "desc" }],
        take: Math.min(Math.max(limit, 1), 200),
        select: {
            id: true,
            keyword: true,
            avgMonthlySearches: true,
            competitionLevel: true,
            competitionIndex: true,
            cpcLow: true,
            cpcHigh: true,
            change3mPct: true,
            changeYoYPct: true,
            currency: true,
            monthlySearchesJson: true,
            createdAt: true,
            source: true,
        },
    });
}

export async function recomputeSignalScoresForBatch(batchId: string) {
    const signals = await prisma.keywordSignal.findMany({
        where: { batchId },
        select: {
            id: true,
            avgMonthlySearches: true,
            competitionLevel: true,
            cpcHigh: true,
            change3mPct: true,
            changeYoYPct: true,
        },
    });

    if (signals.length === 0) {
        return { updated: 0 };
    }

    await prisma.$transaction(
        signals.map((signal) => {
            const { score, reasons } = computeSignalScore(signal);
            return prisma.keywordSignal.update({
                where: { id: signal.id },
                data: { score, scoreReasons: reasons },
            });
        })
    );

    return { updated: signals.length };
}

export type LlmSignalDto = {
    keyword: string;
    avgMonthlySearches: number | null;
    competition: "LOW" | "MEDIUM" | "HIGH" | null;
    cpcLow: number | null;
    cpcHigh: number | null;
    change3mPct: number | null;
    changeYoYPct: number | null;
    score: number;
    scoreReasons: string;
    seasonalitySummary?: string;
};

function summarizeSeasonality(monthlySearches?: Record<string, number> | null) {
    if (!monthlySearches || Object.keys(monthlySearches).length === 0) {
        return null;
    }
    const entries = Object.entries(monthlySearches).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return null;

    let best = entries[0];
    let worst = entries[0];
    for (const entry of entries) {
        if (entry[1] > best[1]) best = entry;
        if (entry[1] < worst[1]) worst = entry;
    }

    const first = entries[0][1];
    const last = entries[entries.length - 1][1];
    const delta = last - first;
    const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    return `Peak ${best[0]}, low ${worst[0]}, trend ${trend}.`;
}

function normalizeCompetition(value?: string | null): LlmSignalDto["competition"] {
    if (!value) return null;
    const normalized = value.toUpperCase();
    if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH") {
        return normalized;
    }
    return null;
}

export async function getTopSignalsForBatch(batchId: string, limit = 30): Promise<LlmSignalDto[]> {
    const rows = await prisma.keywordSignal.findMany({
        where: {
            batchId,
            keyword: { not: "" },
            NOT: { avgMonthlySearches: 0 },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: Math.min(Math.max(limit, 1), 200),
        select: {
            keyword: true,
            avgMonthlySearches: true,
            competitionLevel: true,
            cpcLow: true,
            cpcHigh: true,
            change3mPct: true,
            changeYoYPct: true,
            score: true,
            scoreReasons: true,
            monthlySearchesJson: true,
        },
    });

    return rows.map((signal) => {
        const seasonalitySummary = summarizeSeasonality(
            signal.monthlySearchesJson as Record<string, number> | null
        );
        return {
            keyword: signal.keyword,
            avgMonthlySearches: signal.avgMonthlySearches ?? null,
            competition: normalizeCompetition(signal.competitionLevel),
            cpcLow: signal.cpcLow ?? null,
            cpcHigh: signal.cpcHigh ?? null,
            change3mPct: signal.change3mPct ?? null,
            changeYoYPct: signal.changeYoYPct ?? null,
            score: signal.score ?? 0,
            scoreReasons: signal.scoreReasons ?? "",
            ...(seasonalitySummary ? { seasonalitySummary } : {}),
        };
    });
}

export async function getSignalsForBatchKeywords(
    batchId: string,
    keywords: string[]
): Promise<LlmSignalDto[]> {
    if (keywords.length === 0) {
        return [];
    }
    const rows = await prisma.keywordSignal.findMany({
        where: {
            batchId,
            keyword: { in: keywords },
        },
        select: {
            keyword: true,
            avgMonthlySearches: true,
            competitionLevel: true,
            cpcLow: true,
            cpcHigh: true,
            change3mPct: true,
            changeYoYPct: true,
            score: true,
            scoreReasons: true,
            monthlySearchesJson: true,
        },
    });

    return rows.map((signal) => {
        const seasonalitySummary = summarizeSeasonality(
            signal.monthlySearchesJson as Record<string, number> | null
        );
        return {
            keyword: signal.keyword,
            avgMonthlySearches: signal.avgMonthlySearches ?? null,
            competition: normalizeCompetition(signal.competitionLevel),
            cpcLow: signal.cpcLow ?? null,
            cpcHigh: signal.cpcHigh ?? null,
            change3mPct: signal.change3mPct ?? null,
            changeYoYPct: signal.changeYoYPct ?? null,
            score: signal.score ?? 0,
            scoreReasons: signal.scoreReasons ?? "",
            ...(seasonalitySummary ? { seasonalitySummary } : {}),
        };
    });
}
