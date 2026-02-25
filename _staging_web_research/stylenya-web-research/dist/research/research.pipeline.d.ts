export type WebResearchInput = {
    prompt: string;
    mode: "quick" | "deep";
    market: string;
    language?: string | undefined;
    topic?: "seasonal" | "product" | "supplier" | "general" | undefined;
};
export declare function runResearchPipeline(input: WebResearchInput): Promise<any>;
//# sourceMappingURL=research.pipeline.d.ts.map