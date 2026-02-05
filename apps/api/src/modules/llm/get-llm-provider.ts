import type { LLMProvider } from "./llm.provider";
import { LLMNotConfiguredError } from "./llm.errors";
import { OpenAIProvider } from "./openai.provider";
import { MockLLMProvider } from "./mock.provider";

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
    if (cached) return cached;
    const enabled = process.env.LLM_ENABLED === "true";
    if (!enabled) {
        cached = new MockLLMProvider();
        return cached;
    }
    if (process.env.OPENAI_API_KEY) {
        cached = new OpenAIProvider();
        return cached;
    }
    throw new LLMNotConfiguredError(
        "LLM provider is not configured. Set LLM_ENABLED=true and OPENAI_API_KEY."
    );
}

export function resetLLMProviderCache() {
    cached = null;
}
