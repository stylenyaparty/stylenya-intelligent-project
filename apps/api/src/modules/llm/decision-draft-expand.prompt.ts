import type { DecisionDraftSignal } from "./llm.provider";

const SYSTEM_MESSAGE =
    "You are an AI assistant helping an e-commerce business execute SEO and product optimization decisions.\n" +
    "Use ONLY provided data. Do NOT invent data. Return ONLY valid JSON.";

export type DecisionDraftExpandPromptInput = {
    businessContext: string;
    draft: {
        title: string;
        keywords: string[];
        why_now: string;
        risk_notes: string;
        next_steps: string[];
    };
    focus?: string | null;
    signals: DecisionDraftSignal[];
    productTypes: Array<{ key: string; label: string; synonyms?: string[] }>;
    catalog: Array<{
        id: string;
        title: string;
        productType?: string | null;
        tags?: string[] | null;
    }>;
};

export function buildDecisionDraftExpandPrompt(
    input: DecisionDraftExpandPromptInput,
    options?: { strict?: boolean }
) {
    const strict = options?.strict ?? false;
    const reminder = strict
        ? [
              "IMPORTANT:",
              "- Return ONLY JSON.",
              "- Do NOT include markdown, comments, or trailing text.",
              "- The response MUST match the provided JSON schema exactly.",
          ].join("\n")
        : "";

    const user = [
        "Business context:",
        input.businessContext,
        "",
        "Current draft:",
        JSON.stringify(input.draft, null, 2),
        "",
        `Focus: ${input.focus ?? "none"}`,
        "",
        "Product types involved:",
        JSON.stringify(input.productTypes, null, 2),
        "",
        "Relevant signals (strictly filtered):",
        JSON.stringify(input.signals, null, 2),
        "",
        "Catalog snippet (3-5 related products):",
        JSON.stringify(input.catalog, null, 2),
        "",
        "Return ONLY valid JSON in this exact format:",
        JSON.stringify(
            {
                expanded: {
                    objective: "",
                    checklist: [],
                    seo: {
                        titleIdeas: [],
                        tagIdeas: [],
                        descriptionBullets: [],
                    },
                    assetsNeeded: [],
                    twoWeekPlan: { week1: [], week2: [] },
                    risks: [],
                    successMetrics: [],
                },
            },
            null,
            2
        ),
        "",
        "Checklist: 5-12 items max.",
        "Title ideas: 3-6.",
        "Tag ideas: 10-20.",
        "Description bullets: 5-10.",
        "Assets needed: 3-8.",
        "Week1/Week2: 3-7 tasks each.",
        "Risks: 2-5.",
        "Success metrics: 3-6.",
        "No markdown. JSON only.",
        reminder,
    ]
        .filter(Boolean)
        .join("\n");

    return {
        system: SYSTEM_MESSAGE,
        user,
        promptSnapshot: {
            system: SYSTEM_MESSAGE,
            user,
            input,
            strict,
        },
    };
}
