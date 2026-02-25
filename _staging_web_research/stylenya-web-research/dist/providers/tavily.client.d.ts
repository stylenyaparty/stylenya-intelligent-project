type TavilySearchOptions = {
    query: string;
    maxResults: number;
    includeDomains?: string[];
    excludeDomains?: string[];
    searchDepth?: "basic" | "advanced";
};
export type TavilyResult = {
    url: string;
    title?: string;
    content?: string;
    score?: number;
    published_date?: string;
};
export declare function tavilySearch(opts: TavilySearchOptions): Promise<TavilyResult[]>;
export {};
//# sourceMappingURL=tavily.client.d.ts.map