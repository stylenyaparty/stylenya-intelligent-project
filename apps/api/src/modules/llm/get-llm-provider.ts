import type { LLMProvider } from "./llm.provider";
import { LLMNotConfiguredError } from "./llm.errors";
import { OpenAIProvider } from "./openai.provider";
import { MockLLMProvider } from "./mock.provider";

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
    if (cached) return cached;
    const provider = process.env.LLM_PROVIDER ?? "disabled";
    if (provider === "mock") {
        cached = new MockLLMProvider();
        return cached;
    }
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
        cached = new OpenAIProvider();
        return cached;
    }
    throw new LLMNotConfiguredError(
        "LLM provider is not configured. Set LLM_PROVIDER=openai and OPENAI_API_KEY."
    );
}

export function resetLLMProviderCache() {
    cached = null;
}
