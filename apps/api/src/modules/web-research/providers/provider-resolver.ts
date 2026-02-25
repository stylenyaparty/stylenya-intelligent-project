import type { WebResearchProvider } from "../web-research.types";
import { TavilyGenkitProvider } from "./tavily.genkit.provider";
import { TavilyHttpProvider } from "./tavily.http.provider";

export function resolveWebResearchProvider(): WebResearchProvider {
    const provider = (process.env.WEB_RESEARCH_PROVIDER ?? "tavily-http").toLowerCase();

    if (provider === "tavily-genkit" || provider === "genkit") {
        return new TavilyGenkitProvider();
    }

    return new TavilyHttpProvider();
}
