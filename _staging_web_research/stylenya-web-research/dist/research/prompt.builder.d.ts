export type Evidence = {
    url: string;
    domain: string;
    title: string;
    snippet: string;
    publishedAt: string | null;
    query: string;
};
export type ResearchPromptInput = {
    prompt: string;
    mode: "quick" | "deep";
    market: string;
    language: string;
    topic?: "seasonal" | "product" | "supplier" | "general";
    evidence: Evidence[];
};
export declare function buildResearchPrompt(input: ResearchPromptInput): string;
//# sourceMappingURL=prompt.builder.d.ts.map