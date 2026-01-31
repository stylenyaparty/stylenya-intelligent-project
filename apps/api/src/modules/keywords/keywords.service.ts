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
    country?: string;
    niche?: string;
    topic?: string;
    maxResults?: number;
    providerUsed?: "mock" | "trends";
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

function normalizeCountry(input: KeywordJobInput) {
    const raw = input.country ?? input.params?.geo ?? "US";
    return raw.trim().toUpperCase();
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

function buildAutoCandidates(params: KeywordJobInput["params"], niche: string) {
    const normalizedNiche = normalizeTerm(niche) ?? "party decorations";
    const occasion = normalizeTerm(params?.occasion ?? "") ?? "seasonal";
    const productType = normalizeTerm(params?.productType ?? "") ?? "decor";
    const audience = normalizeTerm(params?.audience ?? "") ?? "shoppers";
    const geo = normalizeTerm(params?.geo ?? "") ?? "global";

    return uniqueTerms([
        `${occasion} ${productType}`,
        `${normalizedNiche} ${productType}`,
        `${audience} ${normalizedNiche}`,
        `${geo} ${normalizedNiche} ${productType}`,
        `${normalizedNiche} ideas`,
        `${normalizedNiche} trends`,
    ]);
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
    const niche = input.niche ?? "party decorations";
    const seedIds = input.seedIds ?? [];
    const params = input.params ?? {};
    const engine = normalizeEngine(input);
    const language = normalizeLanguage(input.language);
    const country = normalizeCountry(input);
    const maxResults = Math.min(input.maxResults ?? 10, 50);
    const providerUsed = input.providerUsed ?? process.env.KEYWORD_PROVIDER ?? "mock";

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

    const autoCandidates =
        input.mode === "AUTO" || input.mode === "HYBRID" ? buildAutoCandidates(params, niche) : [];

    // 🔧 FIX #1: source no incluye "HYBRID"
    const items: { term: string; source: "CUSTOM" | "AUTO" }[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
        const normalized = normalizeTerm(seed.term);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        items.push({ term: normalized, source: "CUSTOM" });
    }

    for (const candidate of autoCandidates) {
        const normalized = normalizeTerm(candidate);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);

        // 🔧 FIX #2: candidatos siempre "AUTO" (aunque el job sea HYBRID)
        items.push({ term: normalized, source: "AUTO" });
    }

    if (items.length === 0) {
        throw new Error("No keyword items available for the job.");
    }

    // ✅ opcional: mantener salida estable / “Top N”
    const finalItems = items.slice(0, 6);
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

    await prisma.keywordJobItem.createMany({
        data: finalItems.map((item) => ({
            jobId: job.id,
            term: item.term,
            source: item.source,
            status: "PENDING",
        })),
    });

    const createdItems = await prisma.keywordJobItem.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
    });

    return { job, items: createdItems };
}

export async function listKeywordJobs() {
    return prisma.keywordJob.findMany({
        orderBy: { createdAt: "desc" },
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
