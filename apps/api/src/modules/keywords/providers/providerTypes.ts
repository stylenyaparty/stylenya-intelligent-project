export type KeywordResearchSeedInput = {
    seed: string;
    marketplace: string;
    language: string;
    geo: string;
    timeframe: string;
};

export type KeywordSuggestion = {
    term: string;
    interestScore: number;
    competitionScore: number | null;
    summary: string;
    relatedKeywords?: string[];
    providerRaw?: unknown;
    isSeed?: boolean;
};

export interface KeywordResearchProvider {
    getSuggestions(input: KeywordResearchSeedInput): Promise<KeywordSuggestion[]>;
}
