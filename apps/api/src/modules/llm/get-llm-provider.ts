import type { LLMProvider } from "./llm.provider";
import { MockProvider } from "./mock.provider";
import { OpenAIProvider } from "./openai.provider";

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
    if (cached) return cached;
    const provider = process.env.LLM_PROVIDER ?? "mock";
    cached =
        provider === "openai" && process.env.OPENAI_API_KEY
            ? new OpenAIProvider()
            : new MockProvider();
    return cached;
}
