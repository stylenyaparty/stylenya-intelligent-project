import { prisma } from "../../infrastructure/db/prisma.js";
import {
    GoogleTrendsKeywordResearchProvider,
    DEFAULT_TIMEFRAME,
} from "./providers/googleTrendsKeywordResearchProvider.js";
import type { KeywordSuggestion } from "./providers/providerTypes.js";
import { LLMNotConfiguredError } from "../llm/llm.errors.js";
import { suggestKeywords } from "../llm/suggest-keywords.service.js";

const trendsProvider = new GoogleTrendsKeywordResearchProvider();
const runningKeywordJobs = new Set<string>();

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase();
}

class KeywordJobRunError extends Error {
    code: string;
    statusCode: number;

    constructor(code: string, message: string, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
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

    const originalStatus = job.status;
    let runStarted = false;

    if (job.archivedAt) {
        throw new KeywordJobRunError(
            "JOB_ARCHIVED",
            "Archived jobs cannot be run.",
            409
        );
    }

    if (job.status === "RUNNING") {
        throw new KeywordJobRunError(
            "JOB_ALREADY_RUNNING",
            "Job is already running.",
            409
        );
    }

    if (job.status === "DONE") {
        const existingItems = await prisma.keywordJobItem.findMany({
            where: { jobId },
            orderBy: { createdAt: "asc" },
        });
        return { job, items: existingItems };
    }

    if (runningKeywordJobs.has(jobId)) {
        throw new KeywordJobRunError(
            "JOB_ALREADY_RUNNING",
            "Job is already running.",
            409
        );
    }

    runningKeywordJobs.add(jobId);

    try {
        const missingConfig = [];
        if (!job.engine) missingConfig.push("engine");
        if (!job.language) missingConfig.push("language");
        if (!job.country) missingConfig.push("country");
        if (!job.maxResults || job.maxResults <= 0) missingConfig.push("maxResults");
        if (!job.providerUsed) missingConfig.push("providerUsed");
        if (missingConfig.length > 0) {
            throw new KeywordJobRunError(
                "MISSING_JOB_CONFIG",
                `Job is missing required config: ${missingConfig.join(", ")}.`
            );
        }

        if (job.providerUsed !== "trends") {
            throw new KeywordJobRunError(
                "PROVIDER_NOT_CONFIGURED",
                "Selected provider is not configured."
            );
        }

        if (process.env.KEYWORD_TRENDS_ENABLED === "false") {
            throw new KeywordJobRunError(
                "PROVIDER_NOT_CONFIGURED",
                "Google Trends provider is disabled."
            );
        }

        const maxResults = Math.min(job.maxResults ?? 10, 50);

        if (job.mode === "AI") {
            const topic = job.topic?.trim();
            if (!topic) {
                throw new KeywordJobRunError(
                    "MISSING_JOB_CONFIG",
                    "Topic is required for AI keyword jobs."
                );
            }

            const updateResult = await prisma.keywordJob.updateMany({
                where: {
                    id: jobId,
                    archivedAt: null,
                    status: { in: ["PENDING", "FAILED"] },
                },
                data: { status: "RUNNING" },
            });

            if (updateResult.count === 0) {
                const latestJob = await prisma.keywordJob.findUnique({ where: { id: jobId } });
                if (!latestJob) {
                    return null;
                }
                if (latestJob.archivedAt) {
                    throw new KeywordJobRunError(
                        "JOB_ARCHIVED",
                        "Archived jobs cannot be run.",
                        409
                    );
                }
                if (latestJob.status === "RUNNING") {
                    throw new KeywordJobRunError(
                        "JOB_ALREADY_RUNNING",
                        "Job is already running.",
                        409
                    );
                }
                if (latestJob.status === "DONE") {
                    const existingItems = await prisma.keywordJobItem.findMany({
                        where: { jobId },
                        orderBy: { createdAt: "asc" },
                    });
                    return { job: latestJob, items: existingItems };
                }
                throw new KeywordJobRunError(
                    "JOB_ALREADY_RUNNING",
                    "Job is already running.",
                    409
                );
            }

            runStarted = true;

            let keywords: string[];
            try {
                keywords = await suggestKeywords(topic, maxResults);
            } catch (error) {
                if (error instanceof LLMNotConfiguredError) {
                    throw new KeywordJobRunError(
                        "LLM_NOT_CONFIGURED",
                        "LLM provider is not configured."
                    );
                }
                throw error;
            }

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

            return {
                job: updatedJob,
                items,
                seedCount: newKeywords.length,
                keywordsGenerated: newKeywords.length,
                itemsPersisted: newKeywords.length,
            };
        }

        const seedItems =
            job.mode === "AUTO" || job.mode === "HYBRID"
                ? await prisma.keywordSeed.findMany({
                    where: { status: "ACTIVE" },
                    orderBy: { createdAt: "asc" },
                })
                : [];
        const jobSeedItems =
            job.mode === "CUSTOM" || job.mode === "HYBRID"
                ? await prisma.keywordJobItem.findMany({
                    where: { jobId },
                    orderBy: { createdAt: "asc" },
                })
                : [];

        const combinedSeeds = [...seedItems, ...jobSeedItems];
        const seedEntries: Array<{ term: string; source: string }> = [];
        const seedSeen = new Set<string>();
        for (const item of combinedSeeds) {
            const normalized = normalizeKeyword(item.term);
            if (seedSeen.has(normalized)) continue;
            seedSeen.add(normalized);
            seedEntries.push({ term: item.term, source: item.source });
        }
        const seeds = seedEntries.map((item) => item.term);

        if (seeds.length === 0) {
            throw new KeywordJobRunError(
                "NO_SEEDS_MATCHING_JOB",
                "No active seeds available for this job. Add seed keywords or adjust the job scope.",
                409
            );
        }

        const updateResult = await prisma.keywordJob.updateMany({
            where: {
                id: jobId,
                archivedAt: null,
                status: { in: ["PENDING", "FAILED"] },
            },
            data: { status: "RUNNING" },
        });

        if (updateResult.count === 0) {
            const latestJob = await prisma.keywordJob.findUnique({ where: { id: jobId } });
            if (!latestJob) {
                return null;
            }
            if (latestJob.archivedAt) {
                throw new KeywordJobRunError(
                    "JOB_ARCHIVED",
                    "Archived jobs cannot be run.",
                    409
                );
            }
            if (latestJob.status === "RUNNING") {
                throw new KeywordJobRunError(
                    "JOB_ALREADY_RUNNING",
                    "Job is already running.",
                    409
                );
            }
            if (latestJob.status === "DONE") {
                const existingItems = await prisma.keywordJobItem.findMany({
                    where: { jobId },
                    orderBy: { createdAt: "asc" },
                });
                return { job: latestJob, items: existingItems };
            }
            throw new KeywordJobRunError(
                "JOB_ALREADY_RUNNING",
                "Job is already running.",
                409
            );
        }

        runStarted = true;

        const provider = trendsProvider;
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

        for (const item of seedEntries) {
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
                    source: result.isSeed ? (item.source as "CUSTOM" | "AUTO" | "HYBRID" | "AI") : "AUTO",
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
            await prisma.keywordJobItem.deleteMany({ where: { jobId } });
            const updatedJob = await prisma.keywordJob.update({
                where: { id: jobId },
                data: { status: "DONE" },
            });
            return {
                job: updatedJob,
                items: [],
                seedCount: seeds.length,
                keywordsGenerated: 0,
                itemsPersisted: 0,
                warning: "Provider returned 0 results",
            };
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
                skipDuplicates: true,
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

        return {
            job: updatedJob,
            items: results,
            seedCount: seeds.length,
            keywordsGenerated: suggestions.length,
            itemsPersisted: results.length,
        };
    } catch (error) {
        if (isKeywordJobRunError(error)) {
            if (runStarted) {
                await prisma.keywordJob.update({
                    where: { id: jobId },
                    data: { status: originalStatus },
                });
            }
        } else {
            await prisma.keywordJob.update({
                where: { id: jobId },
                data: { status: "FAILED" },
            });
        }
        throw error;
    } finally {
        runningKeywordJobs.delete(jobId);
    }
}

export function isKeywordJobRunError(error: unknown): error is KeywordJobRunError {
    return error instanceof KeywordJobRunError;
}
