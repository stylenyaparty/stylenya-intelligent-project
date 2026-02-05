import { z } from "zod";
import { AppError } from "../../types/app-error.js";
import { LLMNotConfiguredError } from "./llm.errors.js";
import { decisionDraftsResponseSchema, type DecisionDraftsResponse } from "./llm.schemas.js";
import { getLLMProvider } from "./get-llm-provider.js";
import { getOpenAIClient } from "./openai.client.js";
import { buildSandboxPrompt, type SandboxPromptInput } from "./sandbox.prompt.js";

type LLMStatus = {
    configured: boolean;
    provider: "openai" | "mock" | "disabled";
    model?: string;
};

function resolveLLMStatus(): LLMStatus {
    const enabled = process.env.LLM_ENABLED === "true";
    if (!enabled) {
        return { configured: true, provider: "mock", model: "mock" };
    }
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
        configured,
        provider: configured ? "openai" : "disabled",
        model: configured ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : undefined,
    };
}

export function getLLMStatus(): LLMStatus {
    return resolveLLMStatus();
}

export async function generateDecisionDrafts(input: {
    signals: Array<{
        keyword: string;
        avgMonthlySearches: number | null;
        competition: "LOW" | "MEDIUM" | "HIGH" | null;
        cpcLow: number | null;
        cpcHigh: number | null;
        change3mPct: number | null;
        changeYoYPct: number | null;
        score: number;
        scoreReasons: string;
        seasonalitySummary?: string;
    }>;
    maxDrafts: number;
}): Promise<{ drafts: DecisionDraftsResponse["drafts"]; meta: { model?: string } }> {
    try {
        const provider = getLLMProvider();
        const response = await provider.generateDecisionDrafts({
            signals: input.signals,
            maxDrafts: input.maxDrafts,
        });

        const validated = decisionDraftsResponseSchema.safeParse({ drafts: response.drafts });
        if (!validated.success) {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM response did not match the expected schema.");
        }

        const limitedDrafts = validated.data.drafts.slice(0, input.maxDrafts);
        return {
            drafts: limitedDrafts,
            meta: {
                model: response.meta?.model,
            },
        };
    } catch (error) {
        if (error instanceof LLMNotConfiguredError) {
            throw new AppError(400, "LLM_NOT_CONFIGURED", error.message);
        }
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(502, "LLM_PROVIDER_ERROR", "LLM provider error.");
    }
}

const sandboxDraftSchema = z.object({
    title: z.string().min(3),
    rationale: z.string().min(3),
    recommendedActions: z.array(z.string().min(1)).min(1),
    confidence: z.number().min(0).max(100),
});

const sandboxResponseSchema = z.object({
    drafts: z.array(sandboxDraftSchema).min(1),
});

export type SandboxResponse = {
    drafts: Array<z.infer<typeof sandboxDraftSchema>>;
    usage: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
    };
    meta: {
        model: string;
        elapsedMs: number;
    };
};

function resolveMaxTokens() {
    const raw = process.env.OPENAI_MAX_TOKENS;
    if (!raw) {
        return 800;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 800;
    }
    return parsed;
}

export async function generateSandboxDrafts(
    input: SandboxPromptInput
): Promise<SandboxResponse> {
    try {
        const client = getOpenAIClient();
        const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
        const { system, user } = buildSandboxPrompt(input);
        const start = Date.now();

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            temperature: 0.3,
            max_tokens: resolveMaxTokens(),
            response_format: { type: "json_object" },
        });

        const elapsedMs = Date.now() - start;
        const text = response.choices?.[0]?.message?.content?.trim();
        if (!text) {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned an empty response.");
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned invalid JSON.");
        }

        const validated = sandboxResponseSchema.safeParse(parsed);
        if (!validated.success) {
            throw new AppError(
                502,
                "LLM_BAD_OUTPUT",
                "LLM response did not match the expected schema."
            );
        }

        return {
            drafts: validated.data.drafts,
            usage: {
                input_tokens: response.usage?.prompt_tokens,
                output_tokens: response.usage?.completion_tokens,
                total_tokens: response.usage?.total_tokens,
            },
            meta: {
                model,
                elapsedMs,
            },
        };
    } catch (error) {
        if (error instanceof LLMNotConfiguredError) {
            throw new AppError(400, "LLM_NOT_CONFIGURED", error.message);
        }
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(502, "LLM_PROVIDER_ERROR", "LLM provider error.");
    }
}
