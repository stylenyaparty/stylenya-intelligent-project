import { prisma } from "../../infrastructure/db/prisma.js";
import { Prisma } from "@prisma/client";

type KeywordSeedInput = {
    terms: string[];
    tags?: unknown;
};

type KeywordJobInput = {
    mode: "CUSTOM" | "AUTO" | "HYBRID" | "AI";
    marketplace: "ETSY" | "SHOPIFY" | "GOOGLE";
    language: "en" | "es";
    engine?: "google" | "etsy" | "shopify";
    country: string;
    niche?: string;
    topic?: string;
    maxResults?: number;
    providerUsed?: "trends";
    params?: {
        occasion?: string;
        productType?: string;
        audience?: string;
        geo?: string;
    };
    seedIds?: string[];
};


function normalizeTerm(raw: string) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase();
}

function normalizeEngine(input: KeywordJobInput) {
    return (input.engine ?? input.marketplace).toLowerCase();
}

function normalizeLanguage(language: KeywordJobInput["language"]) {
    return language.toLowerCase();
}

function uniqueTerms(terms: string[]) {
    const normalized = terms
        .map(normalizeTerm)
        .filter((term): term is string => Boolean(term));
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const term of normalized) {
        if (!seen.has(term)) {
            seen.add(term);
            unique.push(term);
        }
    }
    return unique;
}

export async function createKeywordSeeds(input: KeywordSeedInput) {
    const normalizedTerms = uniqueTerms(input.terms);

    if (normalizedTerms.length === 0) {
        return { created: [], existing: [] };
    }

    const existing = await prisma.keywordSeed.findMany({
        where: { term: { in: normalizedTerms } },
        orderBy: { createdAt: "asc" },
    });

    const existingTerms = new Set(existing.map((seed) => seed.term));
    const missing = normalizedTerms.filter((term) => !existingTerms.has(term));

    const created = missing.length
        ? await prisma.keywordSeed
            .createMany({
                data: missing.map((term) => ({
                    term,
                    source: "CUSTOM",
                    status: "ACTIVE",
                    ...(input.tags !== undefined
                        ? { tagsJson: input.tags as Prisma.InputJsonValue }
                        : {}),
                })),
            })
            .then(async () =>
                prisma.keywordSeed.findMany({
                    where: { term: { in: missing } },
                    orderBy: { createdAt: "asc" },
                })
            )
        : [];

    return { created, existing };
}

export async function listKeywordSeeds(status?: "ACTIVE" | "ARCHIVED") {
    return prisma.keywordSeed.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
    });
}

export async function updateKeywordSeedStatus(id: string, status: "ACTIVE" | "ARCHIVED") {
    return prisma.keywordSeed.update({
        where: { id },
        data: { status },
    });
}

export async function createKeywordJob(input: KeywordJobInput) {
    const niche = input.niche?.trim() ?? "";
    const seedIds = input.seedIds ?? [];
    const params = input.params ?? {};
    const engine = normalizeEngine(input);
    const language = normalizeLanguage(input.language);
    const country = input.country.trim().toUpperCase();
    const maxResults = Math.min(input.maxResults ?? 10, 50);
    const providerUsed = input.providerUsed ?? process.env.KEYWORD_PROVIDER ?? "trends";

    if (providerUsed !== "trends") {
        throw new Error("Provider is not configured.");
    }

    if (input.mode === "AI") {
        const topic = input.topic?.trim();
        if (!topic) {
            throw new Error("Topic is required for AI mode.");
        }

        const job = await prisma.keywordJob.create({
            data: {
                mode: input.mode,
                marketplace: input.marketplace,
                language,
                engine,
                country,
                niche,
                topic,
                maxResults,
                providerUsed,
                paramsJson: { params, seedIds },
                status: "PENDING",
            },
        });

        return { job, items: [] };
    }

    if ((input.mode === "CUSTOM" || input.mode === "HYBRID") && seedIds.length === 0) {
        throw new Error("Seed selection is required for CUSTOM or HYBRID mode.");
    }

    const seeds =
        seedIds.length > 0
            ? await prisma.keywordSeed.findMany({
                where: { id: { in: seedIds } },
            })
            : [];

    if (seedIds.length > 0 && seeds.length !== seedIds.length) {
        throw new Error("One or more seeds could not be found.");
    }

    const items: { term: string; source: "CUSTOM" | "AUTO" }[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
        const normalized = normalizeTerm(seed.term);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        items.push({ term: normalized, source: "CUSTOM" });
    }

    if (items.length === 0 && (input.mode === "CUSTOM" || input.mode === "HYBRID")) {
        throw new Error("No active seeds available for this job.");
    }

    const finalItems = items;
    const providerRequest =
        providerUsed === "trends"
            ? {
                geo: country,
                timeframe: "today 12-m",
                seeds: finalItems.map((item) => item.term),
            }
            : undefined;

    const job = await prisma.keywordJob.create({
        data: {
            mode: input.mode,
            marketplace: input.marketplace,
            language,
            engine,
            country,
            niche,
            maxResults,
            providerUsed,
            providerRequest,
            paramsJson: { params, seedIds },
            status: "PENDING",
        },
    });

    if (finalItems.length > 0) {
        await prisma.keywordJobItem.createMany({
            data: finalItems.map((item) => ({
                jobId: job.id,
                term: item.term,
                source: item.source,
                status: "PENDING",
            })),
        });
    }

    const createdItems = await prisma.keywordJobItem.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
    });

    return { job, items: createdItems };
}

export async function listKeywordJobs(status: "active" | "archived" | "all" = "active") {
    const where =
        status === "all"
            ? undefined
            : status === "archived"
                ? { archivedAt: { not: null } }
                : { archivedAt: null };

    return prisma.keywordJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
}

export async function archiveKeywordJob(id: string) {
    return prisma.keywordJob.update({
        where: { id },
        data: { archivedAt: new Date() },
    });
}

export async function restoreKeywordJob(id: string) {
    return prisma.keywordJob.update({
        where: { id },
        data: { archivedAt: null },
    });
}

export async function getKeywordJob(id: string) {
    return prisma.keywordJob.findUnique({ where: { id } });
}

export async function listKeywordJobItems(jobId: string) {
    return prisma.keywordJobItem.findMany({
        where: { jobId },
        orderBy: { createdAt: "asc" },
    });
}

export async function promoteKeywordJobItem(id: string) {
    const item = await prisma.keywordJobItem.findUnique({
        where: { id },
        include: { job: true },
    });

    if (!item) {
        return null;
    }

    const keyword = item.term;
    const engine = item.job.engine ?? item.job.marketplace.toLowerCase();
    const language = item.job.language;
    const country = item.job.country;

    const existing = await prisma.promotedKeywordSignal.findUnique({
        where: {
            keyword_engine_language_country: {
                keyword,
                engine,
                language,
                country,
            },
        },
    });

    if (existing) {
        return { created: false, signal: existing };
    }

    const resultJson = item.resultJson as
        | { interestScore?: number; competitionScore?: number }
        | null
        | undefined;

    const signal = await prisma.promotedKeywordSignal.create({
        data: {
            keyword,
            jobItemId: item.id,
            engine,
            language,
            country,
            interestScore: typeof resultJson?.interestScore === "number"
                ? resultJson.interestScore
                : null,
            competitionScore: typeof resultJson?.competitionScore === "number"
                ? resultJson.competitionScore
                : null,
            priority: "HIGH",
        },
    });

    return { created: true, signal };
}

export async function listPromotedKeywordSignals() {
    return prisma.promotedKeywordSignal.findMany({
        orderBy: { promotedAt: "desc" },
    });
}
