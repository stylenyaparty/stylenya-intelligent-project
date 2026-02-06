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

function extractOutputText(data: any): string | null {
    const msg = data?.output?.find((o: any) => o.type === "message");
    const part = msg?.content?.find(
        (c: any) => c.type === "output_text" || c.type === "text"
    );
    const text = part?.text?.trim();
    if (text) return text;
    const rootText = data?.output_text?.trim?.();
    return rootText || null;
}

function buildInputMessages(system: string, user: string) {
    return [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
    ];
}

async function callResponsesApi(params: {
    apiKey: string;
    model: string;
    input: Array<{ role: string; content: Array<{ type: string; text: string }> }>;
    maxOutputTokens: number;
}) {
    const supportsTemperature = !params.model.startsWith("gpt-5");
    const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
            model: params.model,
            input: params.input,
            // opcional: baja variabilidad
            ...(supportsTemperature ? { temperature: 0.2 } : {}),
            // opcional: top cap, equivalente a max_tokens
            max_output_tokens: Number.isFinite(params.maxOutputTokens)
                ? params.maxOutputTokens
                : 900,
            // forzar JSON (útil si tu prompt pide JSON)
            text: { format: { type: "json_object" } },
        }),
    });

    if (!res.ok) {
        const body = await readErrorBody(res);
        throw new AppError(
            502,
            "LLM_PROVIDER_ERROR",
            `OpenAI error ${res.status}: ${body ?? "no body"}`
        );
    }

    return res.json();
}

async function readErrorBody(res: Response) {
    try {
        const txt = await res.text();
        return txt?.slice(0, 2000); // cap: evita logs gigantes
    } catch {
        return null;
    }
}

export class OpenAIProvider implements LLMProvider {
    async generateDecisionDrafts(payload: DecisionDraftPayload): Promise<DecisionDraftResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY missing");
        }

        const model =
            process.env.LLM_MODEL_GENERATE ?? process.env.OPENAI_MODEL ?? "gpt-5.2";
        const fallbackModel = process.env.LLM_MODEL_GENERATE_FALLBACK;
        const maxOutputTokens = Number.parseInt(
            process.env.MAX_OUTPUT_TOKENS_GENERATE ?? "900",
            10
        );
        const { system, user } = buildDecisionDraftPrompt(payload);
        const input = buildInputMessages(system, user);
        let usedModel = model;
        let data = await callResponsesApi({ apiKey, model, input, maxOutputTokens });
        const text = extractOutputText(data);
        if (!text) {
            const outputTypes = Array.isArray(data?.output)
                ? data.output.map((item: any) => item?.type).filter(Boolean)
                : null;
            const outputPreview = data?.output
                ? JSON.stringify(data.output).slice(0, 1200)
                : null;
            if (fallbackModel) {
                usedModel = fallbackModel;
                data = await callResponsesApi({
                    apiKey,
                    model: fallbackModel,
                    input,
                    maxOutputTokens,
                });
                const retryText = extractOutputText(data);
                if (retryText) {
                    return this.parseDecisionDrafts(retryText, data, usedModel);
                }
            }
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned an empty response.", {
                model: data?.model ?? usedModel,
                responseId: data?.id ?? null,
                outputTypes,
                hasOutputText: Boolean(data?.output_text),
                outputPreview,
                fallbackModel: fallbackModel ?? null,
            });
        }
        return this.parseDecisionDrafts(text, data, usedModel);
    }

    private parseDecisionDrafts(text: string, data: any, model: string): DecisionDraftResult {
        let parsed: unknown;
        try {
            function extractLikelyJson(raw: string): string {
                const s = raw.trim();

                // Remove ```json fences
                const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                if (fenced?.[1]) return fenced[1].trim();

                // Try to cut from first "{" to last "}"
                const first = s.indexOf("{");
                const last = s.lastIndexOf("}");
                if (first !== -1 && last !== -1 && last > first) {
                    return s.slice(first, last + 1).trim();
                }
                return s;
            }
            function sanitizeJson(raw: string) {
                const withoutBom = raw.replace(/^\uFEFF/, "");
                return withoutBom.replace(/,\s*([}\]])/g, "$1");
            }
            const candidate = sanitizeJson(extractLikelyJson(text));
            parsed = JSON.parse(candidate);
        } catch {
            const snippet = text.slice(0, 1200);
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned invalid JSON.", {
                model: data?.model ?? model,
                responseId: data?.id ?? null,
                rawSnippet: snippet,
            });
        }

        const validated = decisionDraftsResponseSchema.safeParse(parsed);
        if (!validated.success) {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM response did not match the expected schema.");
        }

        return {
            drafts: validated.data.drafts,
            meta: { model: data?.model ?? model },
        };
    }

    async expandDecisionDraft(payload: DecisionDraftExpansionPayload): Promise<DecisionDraftExpansionResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY missing");
        }

        const model = process.env.LLM_MODEL_EXPAND ?? process.env.OPENAI_MODEL ?? "gpt-5.2";
        const fallbackModel = process.env.LLM_MODEL_EXPAND_FALLBACK;
        const maxOutputTokens = Number.parseInt(
            process.env.MAX_OUTPUT_TOKENS_EXPAND ?? "900",
            10
        );
        const input = buildInputMessages(payload.prompt.system, payload.prompt.user);

        let usedModel = model;
        let data = await callResponsesApi({ apiKey, model, input, maxOutputTokens });
        let text = extractOutputText(data);
        if (!text && fallbackModel) {
            usedModel = fallbackModel;
            data = await callResponsesApi({
                apiKey,
                model: fallbackModel,
                input,
                maxOutputTokens,
            });
            text = extractOutputText(data);
        }

        if (!text) {
            throw new AppError(502, "LLM_BAD_OUTPUT", "LLM returned an empty response.", {
                model: data?.model ?? usedModel,
                responseId: data?.id ?? null,
                fallbackModel: fallbackModel ?? null,
            });
        }

        return {
            content: text,
            meta: {
                model: data?.model ?? usedModel,
                // Responses API usage fields
                tokensIn: data?.usage?.input_tokens,
                tokensOut: data?.usage?.output_tokens,
            },
        };
    }
}
