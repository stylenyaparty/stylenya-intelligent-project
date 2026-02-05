export type DecisionDraftSignal = {
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
};

export type DecisionDraftPayload = {
    signals: DecisionDraftSignal[];
    maxDrafts: number;
};

export type DecisionDraftResult = {
    drafts: Array<{
        title: string;
        keywords: string[];
        why_now: string;
        risk_notes: string;
        next_steps: string[];
    }>;
    meta?: {
        model?: string;
    };
};

export interface LLMProvider {
    generateDecisionDrafts(payload: DecisionDraftPayload): Promise<DecisionDraftResult>;
}
