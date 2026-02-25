export declare function clamp(n: number, min?: number, max?: number): number;
export declare function normalizeMentions(mentions: number, cap?: number): number;
export declare function computeResearchScore(input: {
    mentions: number;
    recencyScore: number;
    sourcesCount?: number;
    domainsCount?: number;
}): number;
type ScorableRow = {
    mentions: number;
    recencyScore: number;
    sourcesCount?: number;
    domainsCount?: number;
    researchScore?: number;
};
export declare function scoreAndSortRows(rows: ScorableRow[]): {
    researchScore: number;
    mentions: number;
    recencyScore: number;
    sourcesCount?: number;
    domainsCount?: number;
}[];
export {};
//# sourceMappingURL=scoring.d.ts.map