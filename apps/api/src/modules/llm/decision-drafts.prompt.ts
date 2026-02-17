import type { DecisionDraftSignal } from "./llm.provider";

const SYSTEM_MESSAGE =
    "You are an AI assistant helping an e-commerce business decide SEO and product focus.\n" +
    "Use ONLY the provided keyword signals.\n" +
    "Do NOT invent data.\n" +
    "Be concise, specific, and actionable.";

export type DecisionDraftPromptInput = {
    signals: DecisionDraftSignal[];
    maxDrafts: number;
    runNonce?: string;
};

export function buildDecisionDraftPrompt(input: DecisionDraftPromptInput) {
    const constraints = [
        "- SEO Focus is bi-weekly.",
        "- Propose at most 5 decision drafts.",
        "- Each draft MUST reference exact keywords from the input.",
        "- Include why the opportunity matters now.",
        "- Include risks.",
        "- Include concrete next steps.",
        "- Provide DIVERSE drafts; avoid repeating the same structure and titles from prior runs.",
    ].join("\n");

    const user = [
        "Business context:",
        "Stylenya sells personalized party decorations (stickers, cake toppers, drink stirrers).",
        "Sales are mainly via Etsy and Shopify.",
        "",
        "Constraints:",
        constraints,
        "",
        "Keyword signals:",
        JSON.stringify(input.signals, null, 2),
        ...(input.runNonce ? ["", `Run nonce: ${input.runNonce}`] : []),
        "",
        "Return ONLY valid JSON in this exact format:",
        JSON.stringify(
            {
                drafts: [
                    {
                        title: "",
                        keywords: [],
                        why_now: "",
                        risk_notes: "",
                        next_steps: [],
                    },
                ],
            },
            null,
            2
        ),
        "",
        "No markdown. No explanation. JSON only.",
    ].join("\n");

    return {
        system: SYSTEM_MESSAGE,
        user,
    };
}
