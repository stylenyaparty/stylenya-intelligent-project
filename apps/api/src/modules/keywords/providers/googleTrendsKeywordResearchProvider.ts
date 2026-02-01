import type {
    KeywordResearchProvider,
    KeywordResearchSeedInput,
    KeywordSuggestion,
} from "./providerTypes.js";
import { TrendsCache } from "./trendsCache.js";
import { AppError } from "../../../types/app-error.js";

type TrendsClient = {
    interestOverTime: (options: {
        keyword: string | string[];
        geo?: string;
        timeframe?: string;
    }) => Promise<string>;
    relatedQueries: (options: {
        keyword: string | string[];
        geo?: string;
        timeframe?: string;
    }) => Promise<string>;
};

type TrendsClientLoader = () => Promise<TrendsClient>;

type RankedKeyword = {
    query: string;
    value: number | string;
};

type TrendsSeedResponse = {
    timelineValues: number[];
    relatedQueries: { top: RankedKeyword[]; rising: RankedKeyword[] };
};

const DEFAULT_TIMEFRAME = "today 12-m";
const TRANSIENT_ERROR_MESSAGES = ["fetch failed"];
const TRANSIENT_ERROR_CODES = ["ECONNRESET", "ETIMEDOUT"];

function clampScore(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.min(Math.max(Math.round(value), 0), 100);
}

function parseTimelineValues(raw: string) {
    const parsed = JSON.parse(raw) as {
        default?: { timelineData?: Array<{ value?: number[] }> };
    };
    const timelineData = parsed?.default?.timelineData ?? [];
    return timelineData
        .map((entry) => (Array.isArray(entry.value) ? entry.value[0] : null))
        .filter((value): value is number => typeof value === "number");
}

function parseRelatedQueries(raw: string) {
    const parsed = JSON.parse(raw) as {
        default?: { rankedList?: Array<{ rankedKeyword?: RankedKeyword[] }> };
    };
    const rankedList = parsed?.default?.rankedList ?? [];
    const top = rankedList[0]?.rankedKeyword ?? [];
    const rising = rankedList[1]?.rankedKeyword ?? [];
    return { top, rising };
}

function summarizeTimeline(values: number[]) {
    if (values.length === 0) {
        return { average: 0, max: 0, points: 0 };
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = total / values.length;
    const max = Math.max(...values);
    return { average, max, points: values.length };
}

function buildInterestScoreFromTimeline(values: number[]) {
    const summary = summarizeTimeline(values);
    return clampScore(summary.average);
}

function buildInterestScoreFromValue(value: number | string) {
    if (typeof value === "number") {
        return clampScore(value);
    }
    if (typeof value === "string" && value.toLowerCase() === "breakout") {
        return 100;
    }
    return 0;
}

function buildProviderRaw(seed: string, response: TrendsSeedResponse) {
    const timelineSummary = summarizeTimeline(response.timelineValues);
    const trimRanked = (queries: RankedKeyword[]) =>
        queries.slice(0, 5).map((query) => ({
            query: query.query,
            value: query.value,
        }));

    return {
        seed,
        relatedQueries: {
            top: trimRanked(response.relatedQueries.top),
            rising: trimRanked(response.relatedQueries.rising),
        },
        timeline: timelineSummary,
    };
}

export class GoogleTrendsKeywordResearchProvider implements KeywordResearchProvider {
    private readonly clientLoader: TrendsClientLoader;
    private clientPromise?: Promise<TrendsClient>;
    private readonly cache: TrendsCache<TrendsSeedResponse>;

    constructor(
        client?: TrendsClient,
        cache = new TrendsCache<TrendsSeedResponse>()
    ) {
        this.clientLoader = client
            ? async () => client
            : async () => {
                const module = await import("google-trends-api");
                return module.default as TrendsClient;
            };
        this.cache = cache;
    }

    async getSuggestions(input: KeywordResearchSeedInput): Promise<KeywordSuggestion[]> {
        const timeframe = input.timeframe || DEFAULT_TIMEFRAME;
        const cacheKey = `${input.seed}|${input.geo}|${timeframe}`;
        const cached = this.cache.get(cacheKey);
        const response =
            cached ??
            (await this.fetchSeedDataWithRetry({
                seed: input.seed,
                geo: input.geo,
                timeframe,
            }));

        if (!cached) {
            this.cache.set(cacheKey, response);
        }

        const providerRaw = buildProviderRaw(input.seed, response);
        const suggestions = this.buildSuggestions(input.seed, response, providerRaw, input.geo);
        if (suggestions.length > 0) {
            return suggestions;
        }

        const interestScore = buildInterestScoreFromTimeline(response.timelineValues);
        return [
            {
                term: input.seed,
                interestScore,
                competitionScore: null,
                summary: `Google Trends interest for "${input.seed}" averages ${interestScore}/100 in ${input.geo}.`,
                providerRaw,
                isSeed: true,
            },
        ];
    }

    private async fetchSeedData(input: {
        seed: string;
        geo: string;
        timeframe: string;
    }): Promise<TrendsSeedResponse> {
        const client = await this.getClient();
        const [timelineRaw, relatedRaw] = await Promise.all([
            client.interestOverTime({
                keyword: input.seed,
                geo: input.geo,
                timeframe: input.timeframe,
            }),
            client.relatedQueries({
                keyword: input.seed,
                geo: input.geo,
                timeframe: input.timeframe,
            }),
        ]);

        if (this.isBlockedResponse(timelineRaw) || this.isBlockedResponse(relatedRaw)) {
            throw new AppError(
                503,
                "PROVIDER_TEMP_BLOCKED",
                "Google Trends temporarily blocked. Try again in 30–60 seconds.",
                { provider: "TRENDS" }
            );
        }

        return {
            timelineValues: parseTimelineValues(timelineRaw),
            relatedQueries: parseRelatedQueries(relatedRaw),
        };
    }

    private buildSuggestions(
        seed: string,
        response: TrendsSeedResponse,
        providerRaw: unknown,
        geo: string
    ): KeywordSuggestion[] {
        const suggestions: KeywordSuggestion[] = [];
        const seen = new Set<string>();

        const addSuggestion = (query: RankedKeyword) => {
            const normalized = query.query.trim().toLowerCase();
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            const interestScore = buildInterestScoreFromValue(query.value);
            suggestions.push({
                term: query.query,
                interestScore,
                competitionScore: null,
                summary: `Google Trends interest for "${query.query}" is ${interestScore}/100 in ${geo}.`,
                providerRaw,
            });
        };

        response.relatedQueries.top.forEach(addSuggestion);
        response.relatedQueries.rising.forEach(addSuggestion);

        if (suggestions.length === 0) {
            return [];
        }

        if (!seen.has(seed.trim().toLowerCase())) {
            const interestScore = buildInterestScoreFromTimeline(response.timelineValues);
            suggestions.push({
                term: seed,
                interestScore,
                competitionScore: null,
                summary: `Google Trends interest for "${seed}" averages ${interestScore}/100 in ${geo}.`,
                providerRaw,
                isSeed: true,
            });
        }

        return suggestions;
    }

    private async getClient() {
        if (!this.clientPromise) {
            this.clientPromise = this.clientLoader();
        }
        return this.clientPromise;
    }

    private async fetchSeedDataWithRetry(input: {
        seed: string;
        geo: string;
        timeframe: string;
    }): Promise<TrendsSeedResponse> {
        try {
            return await this.fetchSeedData(input);
        } catch (error) {
            if (this.isProviderBlockedError(error)) {
                throw error;
            }
            if (this.isTransientError(error)) {
                await this.delay(300);
                try {
                    return await this.fetchSeedData(input);
                } catch (retryError) {
                    throw this.normalizeProviderError(retryError);
                }
            }
            throw this.normalizeProviderError(error);
        }
    }

    private normalizeProviderError(error: unknown) {
        if (error instanceof AppError) {
            return error;
        }
        if (this.isProviderBlockedError(error)) {
            return new AppError(
                503,
                "PROVIDER_TEMP_BLOCKED",
                "Google Trends temporarily blocked. Try again in 30–60 seconds.",
                { provider: "TRENDS" }
            );
        }
        return new AppError(
            503,
            "PROVIDER_UNAVAILABLE",
            "Google Trends is temporarily unavailable. Try again shortly.",
            { provider: "TRENDS" }
        );
    }

    private isTransientError(error: unknown) {
        if (!error || typeof error !== "object") {
            return false;
        }
        const err = error as { code?: string; message?: string };
        if (err.code && TRANSIENT_ERROR_CODES.includes(err.code)) {
            return true;
        }
        if (err.message) {
            const message = err.message.toLowerCase();
            return TRANSIENT_ERROR_MESSAGES.some((value) => message.includes(value));
        }
        return false;
    }

    private isProviderBlockedError(error: unknown) {
        if (!error || typeof error !== "object") {
            return false;
        }
        const err = error as { message?: string; requestBody?: string };
        if (!err.message || !err.message.includes("not valid JSON")) {
            return false;
        }
        const body = err.requestBody ?? "";
        return this.isBlockedResponse(body);
    }

    private isBlockedResponse(body: string) {
        return /<html/i.test(body) || /302 Moved/i.test(body) || /\/sorry\/index/i.test(body);
    }

    private async delay(ms: number) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export { DEFAULT_TIMEFRAME };
