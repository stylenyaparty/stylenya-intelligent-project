import type {
    DecisionDraftExpansionPayload,
    DecisionDraftExpansionResult,
    DecisionDraftPayload,
    DecisionDraftResult,
    LLMProvider,
} from "./llm.provider";

export class MockLLMProvider implements LLMProvider {
    async generateDecisionDrafts(payload: DecisionDraftPayload): Promise<DecisionDraftResult> {
        const maxDrafts = Math.min(Math.max(payload.maxDrafts, 1), 5);
        const signals = payload.signals;
        const chunks: Array<typeof signals> = [];

        for (let i = 0; i < signals.length; i += 3) {
            chunks.push(signals.slice(i, i + 3));
            if (chunks.length >= maxDrafts) break;
        }

        const drafts = chunks.map((group, index) => {
            const keywords = group.map((signal) => signal.keyword);
            const topKeyword = keywords[0] ?? "keyword";
            return {
                title: `Prioritize ${topKeyword} intent`,
                keywords,
                why_now: `Signals show strong momentum with score ${group[0]?.score ?? 0}.`,
                risk_notes: "Demand could be seasonal; validate with recent listings performance.",
                next_steps: [
                    "Draft two SEO-optimized listings using the exact keyword phrasing.",
                    "Publish a Shopify collection landing page aligned to the keyword set.",
                ],
            };
        });

        return {
            drafts,
            meta: { model: "mock" },
        };
    }

    async expandDecisionDraft(
        payload: DecisionDraftExpansionPayload
    ): Promise<DecisionDraftExpansionResult> {
        const { draft, focus, signals, productTypes } = payload.input;
        const keywords = draft.keywords.length > 0 ? draft.keywords : signals.map((s) => s.keyword);
        const primaryKeyword = keywords[0] ?? draft.title;
        const productTypeLabels = productTypes.flatMap((type) => [
            type.label,
            ...(type.synonyms ?? []),
        ]);
        const focusHint = focus?.trim() ? ` ${focus.trim()}` : "";

        const tagBase = [
            primaryKeyword,
            ...keywords.slice(1, 6),
            ...productTypeLabels.slice(0, 4),
        ]
            .filter(Boolean)
            .map((value) => value.toLowerCase());

        const tagCandidates = Array.from(
            new Set(
                [
                    ...tagBase,
                    ...tagBase.map((value) => `${value} gift`),
                    ...tagBase.map((value) => `${value} party`),
                    ...tagBase.map((value) => `${value} decor`),
                    ...tagBase.map((value) => `${value} personalized`),
                ].filter(Boolean)
            )
        );

        while (tagCandidates.length < 12) {
            tagCandidates.push(`${primaryKeyword.toLowerCase()} trend`);
            tagCandidates.push(`${primaryKeyword.toLowerCase()} custom`);
        }

        const tagIdeas = tagCandidates.slice(0, 15);

        const response = {
            expanded: {
                objective: `Strengthen ${primaryKeyword} visibility with a focused SEO refresh.${focusHint}`,
                checklist: [
                    `Validate top intent keywords for ${primaryKeyword}.`,
                    "Audit existing listings for missing metadata.",
                    "Refresh hero images to match search intent.",
                    "Update product titles with priority terms.",
                    "Align tags across Etsy + Shopify.",
                    "Schedule a 2-week execution sprint.",
                ],
                seo: {
                    titleIdeas: [
                        `${primaryKeyword} essentials`,
                        `${primaryKeyword} upgrade`,
                        `Best ${primaryKeyword} picks`,
                    ],
                    tagIdeas,
                    descriptionBullets: [
                        "Highlight personalization options and materials.",
                        "Reinforce occasion-specific use cases.",
                        "Include shipping timelines clearly.",
                        "Call out bundle or set options.",
                        "Add FAQ-style sizing guidance.",
                    ],
                },
                assetsNeeded: [
                    "Updated lifestyle photography",
                    "SEO-optimized product copy",
                    "New tag list for listings",
                    "A/B test plan",
                ],
                twoWeekPlan: {
                    week1: [
                        "Review draft keywords vs. listings.",
                        "Draft new title + tag variants.",
                        "Update 2-3 top listings.",
                    ],
                    week2: [
                        "Ship refreshed assets.",
                        "Monitor listing performance.",
                        "Document learnings for next sprint.",
                    ],
                },
                risks: [
                    "Seasonal demand may soften mid-cycle.",
                    "Inventory constraints could limit rollout speed.",
                ],
                successMetrics: [
                    "Increase organic impressions by 15%.",
                    "Improve CTR on updated listings.",
                    "Lift conversions on refreshed products.",
                ],
            },
        };

        const content = JSON.stringify(response);

        return {
            content,
            meta: { model: "mock" },
        };
    }
}
