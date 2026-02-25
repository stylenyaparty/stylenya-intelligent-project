import OpenAI from "openai";

export type LlmStructuredError = {
    name: string;
    message: string;
    code?: string;
    status?: number;
    isRateLimit?: boolean;
    timeout?: boolean;
    stage?: "llm";
};

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    return new OpenAI({ apiKey });
}

export function toLlmStructuredError(error: unknown): LlmStructuredError {
    const err = error as any;
    const status = Number(err?.status ?? err?.statusCode ?? err?.response?.status);
    const code = typeof err?.code === "string" ? err.code : undefined;
    const message = typeof err?.message === "string" ? err.message : "LLM request failed";

    return {
        name: typeof err?.name === "string" ? err.name : "LLMError",
        message,
        ...(code ? { code } : {}),
        ...(Number.isFinite(status) ? { status } : {}),
        ...(status === 429 || code === "rate_limit_exceeded" ? { isRateLimit: true } : {}),
    };
}

export async function callOpenAIJsonWithRetry(input: {
    prompt: string;
    temperature: number;
    timeoutMs?: number;
}): Promise<string> {
    const client = getOpenAIClient();
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 60_000);
    const retryMax = Number(process.env.OPENAI_RETRY_MAX ?? 3);
    const retryBaseMs = Number(process.env.OPENAI_RETRY_BASE_MS ?? 500);
    const retryMaxMs = Number(process.env.OPENAI_RETRY_MAX_MS ?? 8_000);

    for (let attempt = 0; attempt <= retryMax; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? timeoutMs);

        try {
            const resp = await client.responses.create(
                {
                    model: "gpt-4o-mini",
                    input: [{ role: "user", content: input.prompt }],
                    temperature: input.temperature,
                },
                { signal: controller.signal }
            );

            return String((resp as any).output_text ?? "").trim();
        } catch (error) {
            const mapped = toLlmStructuredError(error);
            const isTimeout = (error as any)?.name === "AbortError";

            if (isTimeout) {
                throw {
                    name: "LLMTimeoutError",
                    message: `LLM request timed out after ${input.timeoutMs ?? timeoutMs}ms`,
                    timeout: true,
                    stage: "llm",
                } satisfies LlmStructuredError;
            }

            const isRateLimit = mapped.isRateLimit === true;
            if (!isRateLimit || attempt === retryMax) {
                throw mapped;
            }

            const expDelay = Math.min(retryMaxMs, retryBaseMs * Math.pow(2, attempt));
            const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(expDelay * 0.2)));
            const delayMs = expDelay + jitter;
            console.warn("[openai] rate limit retry", { attempt: attempt + 1, delayMs });
            await wait(delayMs);
        } finally {
            clearTimeout(timer);
        }
    }

    throw {
        name: "LLMRetryExhausted",
        message: "OpenAI retries exhausted",
    } satisfies LlmStructuredError;
}
