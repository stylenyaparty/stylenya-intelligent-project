import { z } from "zod";
import { AppError } from "../../types/app-error.js";
import { LLMNotConfiguredError } from "./llm.errors.js";
import { decisionDraftsResponseSchema, type DecisionDraftsResponse } from "./llm.schemas.js";
import { getLLMProvider } from "./get-llm-provider.js";
import { getOpenAIClient } from "./openai.client.js";
import { buildSandboxPrompt, type SandboxPromptInput } from "./sandbox.prompt.js";

type LLMStatus = {
    configured: boolean;
    provider: "openai" | "disabled";
    model?: string;
};

function resolveLLMStatus(): LLMStatus {
    const provider = process.env.LLM_PROVIDER ?? "disabled";
    if (provider === "openai") {
        const configured = Boolean(process.env.OPENAI_API_KEY);
        return {
            configured,
            provider: configured ? "openai" : "disabled",
            model: configured ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : undefined,
        };
    }
    if (provider === "mock") {
        return { configured: true, provider: "openai", model: "mock" };
    }
    return { configured: false, provider: "disabled" };
}

export function getLLMStatus(): LLMStatus {
    return resolveLLMStatus();
}

export async function generateDecisionDrafts(input: {
    signals: Array<{
        id: string;
        keyword: string;
        keywordNormalized: string;
        source: string;
        geo?: string | null;
        language?: string | null;
        createdAt: string;
        avgMonthlySearches?: number | null;
        competitionLevel?: string | null;
        competitionIndex?: number | null;
        cpcLow?: number | null;
        cpcHigh?: number | null;
        change3mPct?: number | null;
        changeYoYPct?: number | null;
        currency?: string | null;
        seasonality?: { bestMonth: string; worstMonth: string; trend: string } | null;
    }>;
    seeds?: string[];
    context?: string;
    maxDrafts: number;
}): Promise<{ drafts: DecisionDraftsResponse["drafts"]; meta: { model?: string } }> {
    try {
        const provider = getLLMProvider();
        const system = [
            "You are an assistant that outputs strict JSON only.",
            "Return JSON matching this structure:",
            JSON.stringify(
                {
                    drafts: [
                        {
                            title: "string",
                            rationale: "string",
                            recommendedActions: ["string"],
                            confidence: 0,
                        },
                    ],
                },
                null,
                2
            ),
            "Confidence must be a number from 0 to 100.",
            "Do not include markdown, code fences, or extra text.",
        ].join("\n");
        const user = JSON.stringify(
            {
                maxDrafts: input.maxDrafts,
                signals: input.signals,
                seeds: input.seeds ?? [],
                context: input.context ?? "",
            },
            null,
            2
        );

        const response = await provider.generateText({
            system,
            user,
            temperature: 0.2,
            maxTokens: 1200,
            responseFormat: "json_object",
        });

        let parsed: unknown;
        try {
            parsed = JSON.parse(response.text);
        } catch (error) {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned invalid JSON.");
        }

        const validated = decisionDraftsResponseSchema.safeParse(parsed);
        if (!validated.success) {
            throw new AppError(
                502,
                "LLM_BAD_OUTPUT",
                "LLM response did not match the expected schema."
            );
        }

        const limitedDrafts = validated.data.drafts.slice(0, input.maxDrafts);
        return {
            drafts: limitedDrafts,
            meta: {
                model:
                    process.env.LLM_PROVIDER === "mock"
                        ? "mock"
                        : process.env.OPENAI_MODEL ?? "gpt-4o-mini",
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
