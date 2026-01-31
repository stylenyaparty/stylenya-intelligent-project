import { prisma } from "../../infrastructure/db/prisma.js";
import { MockKeywordResearchProvider } from "./providers/mockKeywordResearchProvider.js";
import { GoogleTrendsKeywordResearchProvider, DEFAULT_TIMEFRAME } from "./providers/googleTrendsKeywordResearchProvider.js";
import type { KeywordSuggestion } from "./providers/providerTypes.js";
import { suggestKeywords } from "../llm/suggest-keywords.service.js";

const mockProvider = new MockKeywordResearchProvider();
const trendsProvider = new GoogleTrendsKeywordResearchProvider();

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase();
}

function resolveProvider(providerUsed: string) {
    if (providerUsed === "trends") {
        return trendsProvider;
    }
    return mockProvider;
}

function buildResultJson(suggestion: KeywordSuggestion) {
    return {
        summary: suggestion.summary,
        interestScore: suggestion.interestScore,
        competitionScore: suggestion.competitionScore,
        ...(suggestion.relatedKeywords ? { relatedKeywords: suggestion.relatedKeywords } : {}),
    };
}

export async function runKeywordJob(jobId: string) {
    const job = await prisma.keywordJob.findUnique({ where: { id: jobId } });
    if (!job) {
        return null;
    }

    if (job.status === "DONE") {
        const existingItems = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });
        return { job, items: existingItems };
    }

    await prisma.keywordJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
    });

    try {
        if (job.mode === "AI") {
            const topic = job.topic?.trim();
            if (!topic) {
                throw new Error("Topic is required for AI keyword jobs.");
            }

            const max = Math.min(job.maxResults ?? 10, 50);
            const keywords = await suggestKeywords(topic, max);

            const existingItems = await prisma.keywordJobItem.findMany({
                where: { jobId },
            });
            const seen = new Set(existingItems.map((item) => normalizeKeyword(item.term)));
            const newKeywords = keywords.filter((keyword) => {
                const normalized = normalizeKeyword(keyword);
                if (seen.has(normalized)) {
                    return false;
                }
                seen.add(normalized);
                return true;
            });

            if (newKeywords.length > 0) {
                await prisma.keywordJobItem.createMany({
                    data: newKeywords.map((keyword) => ({
                        jobId,
                        term: keyword.trim(),
                        source: "AI",
                        status: "DONE",
                    })),
                });
            }

            const updatedJob = await prisma.keywordJob.update({
                where: { id: jobId },
                data: { status: "DONE" },
            });

            const items = await prisma.keywordJobItem.findMany({
                where: { jobId },
                orderBy: { createdAt: "asc" },
            });

            return { job: updatedJob, items };
        }

        const seedItems = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });
        const provider = resolveProvider(job.providerUsed);
        const seeds = seedItems.map((item) => item.term);
        const existingProviderRequest = job.providerRequest as
            | { geo?: string; timeframe?: string; seeds?: string[] }
            | null
            | undefined;
        const timeframe =
            typeof existingProviderRequest?.timeframe === "string"
                ? existingProviderRequest.timeframe
                : DEFAULT_TIMEFRAME;
        const providerRequest = {
            geo: job.country,
            timeframe,
            seeds,
        };
        if (job.providerUsed === "trends" && !job.providerRequest) {
            await prisma.keywordJob.update({
                where: { id: jobId },
                data: { providerRequest },
            });
        }

        const suggestions: Array<{
            term: string;
            source: "CUSTOM" | "AUTO" | "HYBRID" | "AI";
            resultJson: ReturnType<typeof buildResultJson>;
            providerRaw?: unknown;
        }> = [];
        const seen = new Set<string>();
        const maxResults = Math.min(job.maxResults ?? 10, 50);

        for (const item of seedItems) {
            const results = await provider.getSuggestions({
                seed: item.term,
                marketplace: job.marketplace,
                language: job.language,
                geo: job.country,
                timeframe,
            });

            for (const result of results) {
                const normalized = normalizeKeyword(result.term);
                if (seen.has(normalized)) {
                    continue;
                }
                seen.add(normalized);
                suggestions.push({
                    term: result.term.trim(),
                    source: result.isSeed ? item.source : "AUTO",
                    resultJson: buildResultJson(result),
                    providerRaw: result.providerRaw,
                });
                if (suggestions.length >= maxResults) {
                    break;
                }
            }
            if (suggestions.length >= maxResults) {
                break;
            }
        }

        if (suggestions.length === 0) {
            throw new Error("No keyword suggestions returned from provider.");
        }

        await prisma.$transaction([
            prisma.keywordJobItem.deleteMany({ where: { jobId } }),
            prisma.keywordJobItem.createMany({
                data: suggestions.map((suggestion) => ({
                    jobId,
                    term: suggestion.term,
                    source: suggestion.source,
                    status: "DONE",
                    resultJson: suggestion.resultJson,
                    providerRaw: suggestion.providerRaw ?? null,
                })),
            }),
        ]);

        const results = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });

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
