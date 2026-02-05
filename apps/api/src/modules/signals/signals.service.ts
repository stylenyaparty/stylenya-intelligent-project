import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { parseGkpCsvBuffer } from "./gkp/gkpCsvParser.js";

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
    limit?: number;
    offset?: number;
};

export async function listSignals(filters: SignalListFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

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

    return prisma.keywordSignal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
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
            createdAt: true,
            source: true,
        },
    });
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
