import OpenAI from "openai";
import { LLMNotConfiguredError } from "./llm.errors.js";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (cachedClient) {
        return cachedClient;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new LLMNotConfiguredError("OpenAI API key is not configured.");
    }

    cachedClient = new OpenAI({ apiKey });
    return cachedClient;
}

export function resetOpenAIClient() {
    cachedClient = null;
}
