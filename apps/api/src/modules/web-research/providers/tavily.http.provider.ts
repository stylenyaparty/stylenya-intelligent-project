import type { WebResearchInput, WebResearchProvider } from "../web-research.types";

const TAVILY_URL = "https://api.tavily.com/search";

export class ProviderUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProviderUnavailableError";
    }
}

export class TavilyHttpProvider implements WebResearchProvider {
    async search(input: WebResearchInput) {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            throw new ProviderUnavailableError("Missing TAVILY_API_KEY");
        }

        const timeoutMs = Number(process.env.WEB_RESEARCH_TIMEOUT_MS ?? 20_000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(TAVILY_URL, {
                method: "POST",
                headers: { "content-type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    api_key: apiKey,
                    query: input.query,
                    max_results: input.mode === "deep" ? 12 : 6,
                    search_depth: input.mode === "deep" ? "advanced" : "basic",
                    include_answer: false,
                    include_raw_content: false,
                }),
            });

            if (!response.ok) {
                throw new ProviderUnavailableError(`Tavily request failed with status ${response.status}`);
            }

            const data = (await response.json()) as {
                results?: Array<{
                    url?: string;
                    title?: string;
                    content?: string;
                    published_date?: string;
                    score?: number;
                }>;
            };

            return (data.results ?? [])
                .filter((item): item is { url: string; title?: string; content?: string; published_date?: string; score?: number } => Boolean(item.url))
                .map((item) => ({
                    url: item.url,
                    title: item.title ?? item.url,
                    snippet: item.content,
                    publishedAt: item.published_date ?? null,
                    score: item.score,
                    raw: item,
                }));
        } catch (error) {
            if (error instanceof ProviderUnavailableError) {
                throw error;
            }
            throw new ProviderUnavailableError(error instanceof Error ? error.message : "Provider request failed");
        } finally {
            clearTimeout(timer);
        }
    }
}
