import type { LLMProvider } from "./llm.provider";
import { LLMNotConfiguredError } from "./llm.errors";
import { OpenAIProvider } from "./openai.provider";

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
    if (cached) return cached;
    const provider = process.env.LLM_PROVIDER ?? "disabled";
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
        cached = new OpenAIProvider();
        return cached;
    }
    throw new LLMNotConfiguredError(
        "LLM provider is not configured. Set LLM_PROVIDER=openai and OPENAI_API_KEY."
    );
}
