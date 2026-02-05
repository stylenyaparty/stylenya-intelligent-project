import type { DecisionDraftPayload, DecisionDraftResult, LLMProvider } from "./llm.provider";

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
}
