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
const FALLBACK_TIMEFRAME = "today 3-m";
const TRANSIENT_ERROR_MESSAGES = ["fetch failed"];
const TRANSIENT_ERROR_CODES = ["ECONNRESET", "ETIMEDOUT"];
const DEBUG_TRENDS = process.env.KEYWORD_TRENDS_DEBUG === "true";

const parseNonNegativeInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    return Math.max(0, parsed);
};

const CIRCUIT_BREAKER_MINUTES = parseNonNegativeInt(
    process.env.KEYWORD_TRENDS_CIRCUIT_MINUTES,
    5
);
const MIN_REQUEST_INTERVAL_MS = parseNonNegativeInt(
    process.env.KEYWORD_TRENDS_MIN_INTERVAL_MS,
    800
);
const MAX_RETRIES = parseNonNegativeInt(process.env.KEYWORD_TRENDS_MAX_RETRIES, 1);
const BASE_BACKOFF_MS = parseNonNegativeInt(process.env.KEYWORD_TRENDS_BACKOFF_MS, 300);

let blockedUntil = 0;
let lastRequestAt = 0;
let throttleChain: Promise<void> = Promise.resolve();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryAfterSeconds = () => {
    const now = Date.now();
    return Math.max(0, Math.ceil((blockedUntil - now) / 1000));
};

const buildBlockedError = () =>
    new AppError(
        503,
        "PROVIDER_TEMP_BLOCKED",
        "Google Trends temporarily blocked. Try again later.",
        { provider: "TRENDS", retryAfterSeconds: getRetryAfterSeconds() }
    );

const tripCircuit = () => {
    const cooldownMs = CIRCUIT_BREAKER_MINUTES * 60 * 1000;
    blockedUntil =
        process.env.NODE_ENV === "test"
            ? Date.now() + 250
            : Date.now() + cooldownMs;
};

const assertNotBlocked = () => {
    if (Date.now() < blockedUntil) {
        throw buildBlockedError();
    }
};

const throttleGlobal = async () => {
    const runThrottle = async () => {
        const now = Date.now();
        const delta = now - lastRequestAt;
        const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - delta);
        if (waitMs > 0) {
            await delay(waitMs);
        }
        lastRequestAt = Date.now();
    };

    const next = throttleChain.then(runThrottle, runThrottle);
    throttleChain = next.catch(() => undefined);
    return next;
};

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
    const rankedList = parsed?.default?.rankedList;
    let top: RankedKeyword[] = [];
    let rising: RankedKeyword[] = [];
    if (Array.isArray(rankedList)) {
        top = rankedList[0]?.rankedKeyword ?? [];
        rising = rankedList[1]?.rankedKeyword ?? [];
    } else if (
        rankedList &&
        typeof rankedList === "object" &&
        Array.isArray((rankedList as { rankedKeyword?: RankedKeyword[] }).rankedKeyword)
    ) {
        top = (rankedList as { rankedKeyword?: RankedKeyword[] }).rankedKeyword ?? [];
    }
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
        const timeframe = input.timeframe?.trim() || DEFAULT_TIMEFRAME;
        const geo = input.geo?.toUpperCase() ?? "";
        const cacheKey = `${input.seed}|${geo}|${timeframe}`;
        const cached = this.cache.get(cacheKey);
        let response =
            cached ??
            (await this.fetchSeedDataWithRetry({
                seed: input.seed,
                geo,
                timeframe,
            }));

        if (!cached) {
            this.cache.set(cacheKey, response);
        }

        let providerRaw = buildProviderRaw(input.seed, response);
        this.logDebug(input.seed, geo, timeframe, response);
        let suggestions = this.buildSuggestions(input.seed, response, providerRaw, geo);
        if (
            suggestions.length === 0 &&
            DEBUG_TRENDS &&
            timeframe !== FALLBACK_TIMEFRAME
        ) {
            response = await this.fetchSeedDataWithRetry({
                seed: input.seed,
                geo,
                timeframe: FALLBACK_TIMEFRAME,
            });
            providerRaw = buildProviderRaw(input.seed, response);
            this.logDebug(input.seed, geo, FALLBACK_TIMEFRAME, response, true);
            suggestions = this.buildSuggestions(input.seed, response, providerRaw, geo);
        }
        return suggestions;
    }

    private async fetchSeedData(input: {
        seed: string;
        geo: string;
        timeframe: string;
    }): Promise<TrendsSeedResponse> {
        assertNotBlocked();
        await throttleGlobal();
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
            tripCircuit();
            throw buildBlockedError();
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
        let attempt = 0;
        while (true) {
            try {
                return await this.fetchSeedData(input);
            } catch (error) {
                if (error instanceof AppError && error.code === "PROVIDER_TEMP_BLOCKED") {
                    throw error;
                }
                if (this.isProviderBlockedError(error)) {
                    tripCircuit();
                    throw buildBlockedError();
                }
                if (this.isTransientError(error) && attempt < MAX_RETRIES) {
                    const backoff = BASE_BACKOFF_MS * (attempt + 1);
                    await delay(backoff);
                    attempt += 1;
                    continue;
                }
                throw this.normalizeProviderError(error);
            }
        }
    }

    private normalizeProviderError(error: unknown) {
        if (error instanceof AppError) {
            return error;
        }
        if (this.isProviderBlockedError(error)) {
            tripCircuit();
            return buildBlockedError();
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

    private logDebug(
        seed: string,
        geo: string,
        timeframe: string,
        response: TrendsSeedResponse,
        fallback = false
    ) {
        if (!DEBUG_TRENDS) {
            return;
        }
        const topSample = response.relatedQueries.top.slice(0, 3).map((item) => item.query);
        const risingSample = response.relatedQueries.rising
            .slice(0, 3)
            .map((item) => item.query);
        console.info("[keyword-trends]", {
            seed,
            geo,
            timeframe,
            fallback,
            timelinePoints: response.timelineValues.length,
            topCount: response.relatedQueries.top.length,
            risingCount: response.relatedQueries.rising.length,
            topSample,
            risingSample,
        });
    }

}

export { DEFAULT_TIMEFRAME };
