export declare function createResearchRun(input: {
    query: string;
    mode?: "quick" | "deep";
    locale?: string;
    geo?: string;
    language?: string;
}): Promise<{
    mode: import(".prisma/client").$Enums.ResearchMode;
    status: import(".prisma/client").$Enums.WebResearchStatus;
    language: string | null;
    id: string;
    query: string;
    createdAt: Date;
    updatedAt: Date;
    locale: string | null;
    geo: string | null;
    seedJson: import("@prisma/client/runtime/library").JsonValue | null;
    timingsMs: import("@prisma/client/runtime/library").JsonValue | null;
    errorJson: import("@prisma/client/runtime/library").JsonValue | null;
    resultJson: import("@prisma/client/runtime/library").JsonValue | null;
}>;
export declare function getResearchRun(id: string): Promise<({
    rows: {
        url: string;
        title: string;
        snippet: string | null;
        publishedAt: Date | null;
        id: string;
        createdAt: Date;
        runId: string;
        score: number | null;
        clusterKey: string | null;
        clusterRank: number | null;
        rawJson: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
    clusters: {
        rank: number | null;
        summary: string | null;
        id: string;
        createdAt: Date;
        runId: string;
        key: string;
        label: string;
        rowCount: number;
        topScore: number | null;
        bundleJson: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
} & {
    mode: import(".prisma/client").$Enums.ResearchMode;
    status: import(".prisma/client").$Enums.WebResearchStatus;
    language: string | null;
    id: string;
    query: string;
    createdAt: Date;
    updatedAt: Date;
    locale: string | null;
    geo: string | null;
    seedJson: import("@prisma/client/runtime/library").JsonValue | null;
    timingsMs: import("@prisma/client/runtime/library").JsonValue | null;
    errorJson: import("@prisma/client/runtime/library").JsonValue | null;
    resultJson: import("@prisma/client/runtime/library").JsonValue | null;
}) | null>;
//# sourceMappingURL=research.service.d.ts.map