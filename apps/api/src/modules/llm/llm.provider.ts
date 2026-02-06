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

export type DecisionDraftExpansionInput = {
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

export type DecisionDraftExpansionPayload = {
    prompt: {
        system: string;
        user: string;
    };
    input: DecisionDraftExpansionInput;
};

export type DecisionDraftExpansionResult = {
    content: string;
    meta?: {
        model?: string;
        tokensIn?: number;
        tokensOut?: number;
    };
};

export interface LLMProvider {
    generateDecisionDrafts(payload: DecisionDraftPayload): Promise<DecisionDraftResult>;
    expandDecisionDraft(payload: DecisionDraftExpansionPayload): Promise<DecisionDraftExpansionResult>;
}
