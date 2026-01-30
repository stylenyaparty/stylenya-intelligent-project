import type { LLMProvider } from "./llm.provider";
import { MockProvider } from "./mock.provider";
import { OpenAIProvider } from "./openai.provider";

export function getLLMProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER ?? "mock";
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
        return new OpenAIProvider();
    }
    return new MockProvider();
}
