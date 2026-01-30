import { prisma } from "../../infrastructure/db/prisma.js";
import { MockKeywordResearchProvider } from "./providers/mockKeywordResearchProvider.js";

type KeywordSeedInput = {
    terms: string[];
    tags?: unknown;
};

type KeywordJobInput = {
    mode: "CUSTOM" | "AUTO" | "HYBRID";
    marketplace: "ETSY" | "SHOPIFY" | "GOOGLE";
    language: "EN" | "ES";
    niche?: string;
    params?: {
        occasion?: string;
        productType?: string;
        audience?: string;
        geo?: string;
    };
    seedIds?: string[];
};

const provider = new MockKeywordResearchProvider();

function normalizeTerm(raw: string) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase();
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
        ? await prisma.keywordSeed.createMany({
              data: missing.map((term) => ({
                  term,
                  source: "CUSTOM",
                  status: "ACTIVE",
                  tagsJson: input.tags ?? null,
              })),
          }).then(async () =>
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

    const items: { term: string; source: "CUSTOM" | "AUTO" | "HYBRID" }[] = [];
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
        items.push({
            term: normalized,
            source: input.mode === "AUTO" ? "AUTO" : "HYBRID",
        });
    }

    if (items.length === 0) {
        throw new Error("No keyword items available for the job.");
    }

    const job = await prisma.keywordJob.create({
        data: {
            mode: input.mode,
            marketplace: input.marketplace,
            language: input.language,
            niche,
            paramsJson: { params, seedIds },
            status: "PENDING",
        },
    });

    await prisma.keywordJobItem.createMany({
        data: items.map((item) => ({
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

export async function runKeywordJob(jobId: string) {
    const job = await prisma.keywordJob.findUnique({ where: { id: jobId } });
    if (!job) {
        return null;
    }

    if (job.status === "DONE") {
        const existingItems = await listKeywordJobItems(jobId);
        return { job, items: existingItems };
    }

    await prisma.keywordJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
    });

    try {
        const items = await listKeywordJobItems(jobId);
        const results = [];

        for (const item of items) {
            const result = provider.research({
                term: item.term,
                marketplace: job.marketplace,
                language: job.language,
            });

            const updated = await prisma.keywordJobItem.update({
                where: { id: item.id },
                data: {
                    status: "DONE",
                    resultJson: result,
                },
            });

            results.push(updated);
        }

        const updatedJob = await prisma.keywordJob.update({
            where: { id: jobId },
            data: { status: "DONE" },
        });

        return { job: updatedJob, items: results };
    } catch (error) {
        await prisma.keywordJob.update({
            where: { id: jobId },
            data: { status: "FAILED" },
        });
        throw error;
    }
}
