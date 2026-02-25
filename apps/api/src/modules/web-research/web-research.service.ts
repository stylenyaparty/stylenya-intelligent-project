import {
    completeWebResearchRun,
    createWebResearchRun,
    failWebResearchRun,
    getWebResearchRunById,
} from "./web-research.repo";
import { runWebResearchPipeline } from "./pipeline/web-research.pipeline";
import { resolveWebResearchProvider } from "./providers/provider-resolver";
import { ProviderUnavailableError } from "./providers/tavily.http.provider";
import type { WebResearchInput, WebResearchProvider } from "./web-research.types";

let providerOverride: WebResearchProvider | null = null;

export function setWebResearchProviderForTests(provider: WebResearchProvider | null) {
    providerOverride = provider;
}

function getProvider() {
    return providerOverride ?? resolveWebResearchProvider();
}

export class WebResearchServiceError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = "WebResearchServiceError";
    }
}

export async function runWebResearch(input: WebResearchInput) {
    const run = await createWebResearchRun(input);

    try {
        const result = await runWebResearchPipeline(input, getProvider());
        return await completeWebResearchRun(run.id, result);
    } catch (error) {
        await failWebResearchRun(run.id, {
            message: error instanceof Error ? error.message : "Unknown error",
            code: error instanceof ProviderUnavailableError ? "PROVIDER_UNAVAILABLE" : "PIPELINE_FAILED",
        });

        if (error instanceof ProviderUnavailableError) {
            throw new WebResearchServiceError("Provider unavailable", 503);
        }

        throw new WebResearchServiceError("Web research execution failed", 500);
    }
}

export async function getWebResearchRun(id: string) {
    return getWebResearchRunById(id);
}
