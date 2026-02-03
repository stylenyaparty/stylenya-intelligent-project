import { prisma } from "../../infrastructure/db/prisma.js";
import {
    GoogleTrendsKeywordResearchProvider,
    DEFAULT_TIMEFRAME,
} from "./providers/googleTrendsKeywordResearchProvider.js";
import { GoogleAdsKeywordProvider } from "./providers/googleAdsKeywordProvider.js";
import type { KeywordResearchProvider, KeywordSuggestion } from "./providers/providerTypes.js";
import { Prisma } from "@prisma/client";
import { AppError, isAppError } from "../../types/app-error.js";
import {
    getGoogleAdsCredentials,
    getGoogleAdsStatus,
} from "../settings/keyword-provider-settings.service.js";

const trendsProvider = new GoogleTrendsKeywordResearchProvider();
const runningKeywordJobs = new Map<string, boolean>();

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase();
}

function normalizeProvider(providerUsed: string) {
    const normalized = providerUsed.trim().toUpperCase();
    if (normalized === "AUTO") return "AUTO";
    if (["GOOGLE_ADS", "GOOGLE-ADS", "GOOGLEADS"].includes(normalized)) {
        return "GOOGLE_ADS";
    }
    return "TRENDS";
}

function buildResultJson(suggestion: KeywordSuggestion) {
    return {
        summary: suggestion.summary,
        interestScore: suggestion.interestScore,
        competitionScore: suggestion.competitionScore,
        ...(suggestion.relatedKeywords ? { relatedKeywords: suggestion.relatedKeywords } : {}),
    };
}

export async function runKeywordJob(jobId: string, options?: { force?: boolean }) {
    if (runningKeywordJobs.get(jobId)) {
        throw new AppError(409, "JOB_ALREADY_RUNNING", "Job is already running.");
    }
    runningKeywordJobs.set(jobId, true);

    const forceRun = options?.force === true;
    let originalStatus: "PENDING" | "RUNNING" | "DONE" | "FAILED" | null = null;
    let runStarted = false;

    try {
        const job = await prisma.keywordJob.findUnique({ where: { id: jobId } });
        if (!job) {
            return null;
        }

        originalStatus = job.status;

        if (job.archivedAt) {
            throw new AppError(
                409,
                "JOB_ARCHIVED",
                "Archived jobs cannot be run."
            );
        }

        if (job.status === "RUNNING") {
            throw new AppError(
                409,
                "JOB_ALREADY_RUNNING",
                "Job is already running."
            );
        }

        if (job.status === "DONE" && !forceRun) {
            const existingItems = await prisma.keywordJobItem.findMany({
                where: { jobId },
                orderBy: { createdAt: "asc" },
            });
            return { job, items: existingItems };
        }

        const missingConfig = [];
        if (!job.engine) missingConfig.push("engine");
        if (!job.language) missingConfig.push("language");
        if (!job.country) missingConfig.push("country");
        if (!job.maxResults || job.maxResults <= 0) missingConfig.push("maxResults");
        if (!job.providerUsed) missingConfig.push("providerUsed");
        if (missingConfig.length > 0) {
            throw new AppError(
                400,
                "MISSING_JOB_CONFIG",
                `Job is missing required config: ${missingConfig.join(", ")}.`
            );
        }

        const googleAdsStatus = await getGoogleAdsStatus();
        const normalizedProvider = normalizeProvider(job.providerUsed);
        const resolvedProvider =
            normalizedProvider === "AUTO"
                ? googleAdsStatus.enabled && googleAdsStatus.configured
                    ? "GOOGLE_ADS"
                    : "TRENDS"
                : normalizedProvider === "GOOGLE_ADS"
                    ? "GOOGLE_ADS"
                    : "TRENDS";

        if (normalizedProvider === "GOOGLE_ADS") {
            if (!googleAdsStatus.enabled || !googleAdsStatus.configured) {
                throw new AppError(
                    400,
                    "GOOGLE_ADS_NOT_CONFIGURED",
                    "Google Ads provider is not configured."
                );
            }
        }

        if (resolvedProvider === "TRENDS" && process.env.KEYWORD_TRENDS_ENABLED === "false") {
            throw new AppError(
                400,
                "PROVIDER_NOT_CONFIGURED",
                "Google Trends provider is disabled."
            );
        }

        const maxResults = Math.min(job.maxResults ?? 10, 50);

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
            throw new AppError(
                409,
                "NO_SEEDS_MATCHING_JOB",
                "No active seeds available for this job. Add seed keywords or adjust the job scope."
            );
        }

        const updateResult = await prisma.keywordJob.updateMany({
            where: {
                id: jobId,
                archivedAt: null,
                status: { in: forceRun ? ["PENDING", "FAILED", "DONE"] : ["PENDING", "FAILED"] },
            },
            data: { status: "RUNNING" },
        });

        if (updateResult.count === 0) {
            const latestJob = await prisma.keywordJob.findUnique({ where: { id: jobId } });
            if (!latestJob) {
                return null;
            }
            if (latestJob.archivedAt) {
                throw new AppError(
                    409,
                    "JOB_ARCHIVED",
                    "Archived jobs cannot be run."
                );
            }
            if (latestJob.status === "RUNNING") {
                throw new AppError(
                    409,
                    "JOB_ALREADY_RUNNING",
                    "Job is already running."
                );
            }
            if (latestJob.status === "DONE" && !forceRun) {
                const existingItems = await prisma.keywordJobItem.findMany({
                    where: { jobId },
                    orderBy: { createdAt: "asc" },
                });
                return { job: latestJob, items: existingItems };
            }
            throw new AppError(409, "JOB_ALREADY_RUNNING", "Job is already running.");
        }

        runStarted = true;

        let provider: KeywordResearchProvider = trendsProvider;
        if (resolvedProvider === "GOOGLE_ADS") {
            const credentials = await getGoogleAdsCredentials();
            if (!credentials) {
                throw new AppError(
                    400,
                    "GOOGLE_ADS_NOT_CONFIGURED",
                    "Google Ads provider is not configured."
                );
            }
            provider = new GoogleAdsKeywordProvider(credentials);
        } else if (forceRun) {
            provider = new GoogleTrendsKeywordResearchProvider();
        }
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
        if (resolvedProvider === "TRENDS" && !job.providerRequest) {
            await prisma.keywordJob.update({
                where: { id: jobId },
                data: { providerRequest },
            });
        }

        const suggestions: Array<{
            term: string;
            source: "CUSTOM" | "AUTO" | "HYBRID";
            resultJson: ReturnType<typeof buildResultJson>;
            providerRaw?: unknown;
        }> = [];
        const seen = new Set<string>();

        for (const item of seedEntries) {
            let results: KeywordSuggestion[] = [];
            try {
                results = await provider.getSuggestions({
                    seed: item.term,
                    marketplace: job.marketplace,
                    language: job.language,
                    geo: job.country,
                    timeframe,
                });
            } catch (error) {
                throw error;
            }

            const normalizedSeed = normalizeKeyword(item.term);
            for (const result of results) {
                const normalized = normalizeKeyword(result.term);
                if (result.isSeed || normalized === normalizedSeed) {
                    continue;
                }
                if (seen.has(normalized)) {
                    continue;
                }
                seen.add(normalized);
                suggestions.push({
                    term: result.term.trim(),
                    source: result.isSeed ? (item.source as "CUSTOM" | "AUTO" | "HYBRID") : "AUTO",
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
                    providerRaw: suggestion.providerRaw ?? Prisma.JsonNull,
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
            warning: undefined,
        };
    } catch (error) {
        if (isAppError(error)) {
            if (runStarted && originalStatus) {
                const nextStatus = error.statusCode >= 500 ? "FAILED" : originalStatus;
                await prisma.keywordJob.update({
                    where: { id: jobId },
                    data: { status: nextStatus },
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
