import { AppError } from "../../types/app-error.js";
import { decisionDraftsResponseSchema } from "./llm.schemas.js";
import type {
    DecisionDraftExpansionPayload,
    DecisionDraftExpansionResult,
    DecisionDraftPayload,
    DecisionDraftResult,
    LLMProvider,
} from "./llm.provider";
import { buildDecisionDraftPrompt } from "./decision-drafts.prompt.js";

export class OpenAIProvider implements LLMProvider {
    async generateDecisionDrafts(payload: DecisionDraftPayload): Promise<DecisionDraftResult> {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("LLM provider error");
            }

            const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
            const { system, user } = buildDecisionDraftPrompt(payload);
            const messages = [
                { role: "system", content: system },
                { role: "user", content: user },
            ];

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.2,
                    max_tokens: 900,
                    response_format: { type: "json_object" },
                }),
            });

            if (!response.ok) {
                throw new Error("LLM provider error");
            }

            const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) {
                throw new Error("LLM provider error");
            }

            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch {
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

            return {
                drafts: validated.data.drafts,
                meta: { model },
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new Error("LLM provider error");
        }
    }

    async expandDecisionDraft(
        payload: DecisionDraftExpansionPayload
    ): Promise<DecisionDraftExpansionResult> {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("LLM provider error");
            }

            const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
            const messages = [
                { role: "system", content: payload.prompt.system },
                { role: "user", content: payload.prompt.user },
            ];

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: 0.2,
                    max_tokens: 900,
                    response_format: { type: "json_object" },
                }),
            });

            if (!response.ok) {
                throw new Error("LLM provider error");
            }

            const data = (await response.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) {
                throw new Error("LLM provider error");
            }

            return {
                content: text,
                meta: {
                    model,
                    tokensIn: data.usage?.prompt_tokens,
                    tokensOut: data.usage?.completion_tokens,
                },
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new Error("LLM provider error");
        }
    }
}
