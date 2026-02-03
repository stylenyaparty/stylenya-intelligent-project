import { describe, expect, it, vi } from "vitest";
import type { AppError } from "../src/types/app-error.js";

const setEnv = (overrides: Record<string, string | undefined>) => {
    const previous: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(overrides)) {
        previous[key] = process.env[key];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    return () => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    };
};

const loadProvider = async (overrides: Record<string, string | undefined>) => {
    const restore = setEnv(overrides);
    vi.resetModules();
    const module = await import(
        "../src/modules/keywords/providers/googleTrendsKeywordResearchProvider.js"
    );
    return { module, restore };
};

const timelinePayload = JSON.stringify({
    default: { timelineData: [{ value: [10] }, { value: [55] }] },
});
const relatedPayload = JSON.stringify({
    default: {
        rankedList: [
            { rankedKeyword: [{ query: "alpha idea", value: 55 }] },
            { rankedKeyword: [] },
        ],
    },
});

describe("GoogleTrendsKeywordResearchProvider stability controls", () => {
    it("trips a global circuit breaker after a blocked response", async () => {
        const { module, restore } = await loadProvider({
            KEYWORD_TRENDS_CIRCUIT_MINUTES: "5",
            KEYWORD_TRENDS_MIN_INTERVAL_MS: "0",
            KEYWORD_TRENDS_MAX_RETRIES: "0",
            KEYWORD_TRENDS_BACKOFF_MS: "0",
        });
        try {
            const { GoogleTrendsKeywordResearchProvider } = module;

            const mockInterestOverTime = vi
                .fn()
                .mockResolvedValue("<HTML>302 Moved /sorry/index</HTML>");
            const mockRelatedQueries = vi.fn().mockResolvedValue(relatedPayload);

            const client = {
                interestOverTime: mockInterestOverTime,
                relatedQueries: mockRelatedQueries,
            };

            const provider = new GoogleTrendsKeywordResearchProvider(client);

            let firstError: AppError | undefined;
            try {
                await provider.getSuggestions({ seed: "blocked seed", geo: "us" });
            } catch (error) {
                firstError = error as AppError;
            }

            expect(firstError?.code).toBe("PROVIDER_TEMP_BLOCKED");
            expect(firstError?.details).toMatchObject({
                provider: "TRENDS",
                retryAfterSeconds: expect.any(Number),
            });
            expect(mockInterestOverTime).toHaveBeenCalledTimes(1);

            const secondProvider = new GoogleTrendsKeywordResearchProvider(client);
            await expect(
                secondProvider.getSuggestions({ seed: "blocked seed 2", geo: "us" })
            ).rejects.toMatchObject({ code: "PROVIDER_TEMP_BLOCKED" });
            expect(mockInterestOverTime).toHaveBeenCalledTimes(1);
        } finally {
            restore();
        }
    });

    it("serializes requests globally with a minimum interval", async () => {
        const minIntervalMs = 50;
        const { module, restore } = await loadProvider({
            KEYWORD_TRENDS_CIRCUIT_MINUTES: "5",
            KEYWORD_TRENDS_MIN_INTERVAL_MS: String(minIntervalMs),
            KEYWORD_TRENDS_MAX_RETRIES: "0",
            KEYWORD_TRENDS_BACKOFF_MS: "0",
        });
        try {
            const { GoogleTrendsKeywordResearchProvider } = module;

            const interestStarts: number[] = [];
            const relatedStarts: number[] = [];

            const client = {
                interestOverTime: vi.fn().mockImplementation(async () => {
                    interestStarts.push(Date.now());
                    return timelinePayload;
                }),
                relatedQueries: vi.fn().mockImplementation(async () => {
                    relatedStarts.push(Date.now());
                    return relatedPayload;
                }),
            };

            const providerA = new GoogleTrendsKeywordResearchProvider(client);
            const providerB = new GoogleTrendsKeywordResearchProvider(client);

            await Promise.all([
                providerA.getSuggestions({ seed: "alpha", geo: "us" }),
                providerB.getSuggestions({ seed: "beta", geo: "us" }),
            ]);

            expect(interestStarts).toHaveLength(2);
            expect(interestStarts[1] - interestStarts[0]).toBeGreaterThanOrEqual(
                minIntervalMs
            );
            expect(relatedStarts).toHaveLength(2);
        } finally {
            restore();
        }
    });

    it("retries transient errors up to the configured max", async () => {
        const { module, restore } = await loadProvider({
            KEYWORD_TRENDS_CIRCUIT_MINUTES: "5",
            KEYWORD_TRENDS_MIN_INTERVAL_MS: "0",
            KEYWORD_TRENDS_MAX_RETRIES: "1",
            KEYWORD_TRENDS_BACKOFF_MS: "10",
        });
        try {
            const { GoogleTrendsKeywordResearchProvider } = module;

            let interestCalls = 0;
            const client = {
                interestOverTime: vi.fn().mockImplementation(() => {
                    interestCalls += 1;
                    if (interestCalls === 1) {
                        const error = new Error("timeout") as Error & { code?: string };
                        error.code = "ETIMEDOUT";
                        return Promise.reject(error);
                    }
                    return Promise.resolve(timelinePayload);
                }),
                relatedQueries: vi.fn().mockResolvedValue(relatedPayload),
            };

            const provider = new GoogleTrendsKeywordResearchProvider(client);
            const suggestions = await provider.getSuggestions({
                seed: "retry seed",
                geo: "us",
            });

            expect(suggestions.length).toBeGreaterThan(0);
            expect(client.interestOverTime).toHaveBeenCalledTimes(2);
            expect(client.relatedQueries).toHaveBeenCalledTimes(2);
        } finally {
            restore();
        }
    });

    it("does not retry when max retries is zero", async () => {
        const { module, restore } = await loadProvider({
            KEYWORD_TRENDS_CIRCUIT_MINUTES: "5",
            KEYWORD_TRENDS_MIN_INTERVAL_MS: "0",
            KEYWORD_TRENDS_MAX_RETRIES: "0",
            KEYWORD_TRENDS_BACKOFF_MS: "10",
        });
        try {
            const { GoogleTrendsKeywordResearchProvider } = module;

            const client = {
                interestOverTime: vi.fn().mockImplementation(() => {
                    const error = new Error("timeout") as Error & { code?: string };
                    error.code = "ETIMEDOUT";
                    return Promise.reject(error);
                }),
                relatedQueries: vi.fn().mockResolvedValue(relatedPayload),
            };

            const provider = new GoogleTrendsKeywordResearchProvider(client);

            await expect(
                provider.getSuggestions({ seed: "no retry seed", geo: "us" })
            ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
            expect(client.interestOverTime).toHaveBeenCalledTimes(1);
            expect(client.relatedQueries).toHaveBeenCalledTimes(1);
        } finally {
            restore();
        }
    });
});
