import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";
import { parseCsvFile } from "../products/products.service.js";

const TERM_HEADERS = ["keyword", "search term", "keyword text"];
const AVG_MONTHLY_SEARCHES_HEADERS = ["avg. monthly searches"];
const COMPETITION_HEADERS = ["competition"];
const BID_LOW_HEADERS = ["top of page bid (low range)"];
const BID_HIGH_HEADERS = ["top of page bid (high range)"];
const GEO_HEADERS = ["geo", "location", "country"];
const LANGUAGE_HEADERS = ["language"];

function normalizeHeader(value: string) {
    return value.trim().toLowerCase();
}

function findHeaderIndex(headers: string[], candidates: string[]) {
    const normalized = headers.map(normalizeHeader);
    return normalized.findIndex((header) => candidates.includes(header));
}

function normalizeTerm(term: string) {
    return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNullableNumber(value: string | undefined) {
    if (!value) return null;
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableInt(value: string | undefined) {
    const parsed = parseNullableNumber(value);
    return parsed === null ? null : Math.round(parsed);
}

function parseNullableFloat(value: string | undefined) {
    return parseNullableNumber(value);
}

type GkpImportResult = {
    batch: {
        id: string;
        source: string;
        filename: string | null;
        status: string;
        rowCount: number;
        createdAt: Date;
    };
    importedCount: number;
    skippedDuplicatesCount: number;
};

export async function importGkpCsv(contents: string, filename?: string | null): Promise<GkpImportResult> {
    const { headers, rows } = parseCsvFile(contents);
    if (rows.length === 0) {
        throw new AppError(400, "CSV_EMPTY", "No data rows found in CSV.");
    }

    const termIndex = findHeaderIndex(headers, TERM_HEADERS);
    if (termIndex === -1) {
        throw new AppError(400, "CSV_MISSING_TERM", "CSV missing keyword column.");
    }

    const avgMonthlyIndex = findHeaderIndex(headers, AVG_MONTHLY_SEARCHES_HEADERS);
    const competitionIndex = findHeaderIndex(headers, COMPETITION_HEADERS);
    const bidLowIndex = findHeaderIndex(headers, BID_LOW_HEADERS);
    const bidHighIndex = findHeaderIndex(headers, BID_HIGH_HEADERS);
    const geoIndex = findHeaderIndex(headers, GEO_HEADERS);
    const languageIndex = findHeaderIndex(headers, LANGUAGE_HEADERS);

    const dedupe = new Map<string, Prisma.KeywordSignalCreateManyInput>();
    let skippedDuplicatesCount = 0;

    rows.forEach((row) => {
        const term = row[termIndex]?.trim();
        if (!term) return;
        const termNormalized = normalizeTerm(term);
        if (!termNormalized) return;

        const geoValue = geoIndex >= 0 ? row[geoIndex]?.trim() : null;
        const languageValue = languageIndex >= 0 ? row[languageIndex]?.trim() : null;
        const geo = geoIndex >= 0 ? (geoValue || null) : "US";
        const language = languageIndex >= 0 ? (languageValue || null) : "en";

        const key = `${termNormalized}||${geo ?? ""}||${language ?? ""}`;
        if (dedupe.has(key)) {
            skippedDuplicatesCount += 1;
            return;
        }

        const rawRow: Record<string, string | undefined> = {};
        headers.forEach((header, idx) => {
            rawRow[header] = row[idx];
        });

        dedupe.set(key, {
            term,
            termNormalized,
            source: "GKP_CSV",
            geo,
            language,
            avgMonthlySearches: parseNullableInt(row[avgMonthlyIndex]),
            competition: row[competitionIndex]?.trim() || null,
            topOfPageBidLow: parseNullableFloat(row[bidLowIndex]),
            topOfPageBidHigh: parseNullableFloat(row[bidHighIndex]),
            rawRow,
        });
    });

    if (dedupe.size === 0) {
        throw new AppError(400, "CSV_NO_KEYWORDS", "No valid keyword rows found in CSV.");
    }

    const rowCount = rows.length;
    return prisma.$transaction(async (tx) => {
        const batch = await tx.signalBatch.create({
            data: {
                source: "GKP_CSV",
                filename: filename ?? null,
                status: "IMPORTED",
                rowCount,
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
            batch,
            importedCount: data.length,
            skippedDuplicatesCount,
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
        where.term = { contains: filters.q, mode: "insensitive" };
    }

    return prisma.keywordSignal.findMany({
        where,
        orderBy: { capturedAt: "desc" },
        skip: offset,
        take: limit,
        select: {
            id: true,
            batchId: true,
            term: true,
            avgMonthlySearches: true,
            competition: true,
            topOfPageBidLow: true,
            topOfPageBidHigh: true,
            capturedAt: true,
            source: true,
        },
    });
}
