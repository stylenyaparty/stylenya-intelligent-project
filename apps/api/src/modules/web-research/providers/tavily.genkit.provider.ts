import type { WebResearchInput, WebResearchProvider } from "../web-research.types";
import { TavilyHttpProvider } from "./tavily.http.provider";

const optionalImport = new Function("moduleName", "return import(moduleName)") as (
    moduleName: string
) => Promise<unknown>;

export class TavilyGenkitProvider implements WebResearchProvider {
    async search(input: WebResearchInput) {
        try {
            await optionalImport("genkit");
        } catch {
            // Optional adapter: silently fallback to direct HTTP provider.
        }

        const fallback = new TavilyHttpProvider();
        return fallback.search(input);
    }
}
