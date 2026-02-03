import { AppError } from "../../types/app-error.js";
import { LLMNotConfiguredError } from "./llm.errors.js";
import { decisionDraftsResponseSchema, type DecisionDraftsResponse } from "./llm.schemas.js";
import { getLLMProvider } from "./get-llm-provider.js";

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
    weeklyFocus: { id: string; asOf: string };
    context: Record<string, unknown>;
    maxDrafts: number;
}): Promise<DecisionDraftsResponse> {
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
                            actions: ["string"],
                            confidence: 0,
                            sources: {
                                keywordJobIds: ["string"],
                                signalIds: ["string"],
                                productIds: ["string"],
                            },
                        },
                    ],
                },
                null,
                2
            ),
            "Do not include markdown, code fences, or extra text.",
        ].join("\n");
        const user = JSON.stringify(
            {
                weeklyFocusId: input.weeklyFocus.id,
                asOf: input.weeklyFocus.asOf,
                maxDrafts: input.maxDrafts,
                context: input.context,
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
        return { drafts: limitedDrafts };
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
