import { z } from "zod";
export declare const evidenceSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodString;
    snippet: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    publishedAt: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    url: string;
    title: string;
    snippet: string;
    publishedAt: string | null;
}, {
    url: string;
    title: string;
    snippet?: string | undefined;
    publishedAt?: string | null | undefined;
}>;
export declare const rowSchema: z.ZodObject<{
    rowId: z.ZodString;
    cluster: z.ZodString;
    keyword: z.ZodString;
    intent: z.ZodEnum<["buying", "inspiration", "diy", "informational", "supplier"]>;
    mentions: z.ZodNumber;
    recencyScore: z.ZodNumber;
    researchScore: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    sourcesCount: z.ZodNumber;
    domainsCount: z.ZodNumber;
    topEvidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        snippet: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        publishedAt: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        title: string;
        snippet: string;
        publishedAt: string | null;
    }, {
        url: string;
        title: string;
        snippet?: string | undefined;
        publishedAt?: string | null | undefined;
    }>, "many">>;
    clusterId: z.ZodOptional<z.ZodString>;
    rank: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    cluster: string;
    rowId: string;
    keyword: string;
    intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
    mentions: number;
    recencyScore: number;
    researchScore: number;
    sourcesCount: number;
    domainsCount: number;
    topEvidence: {
        url: string;
        title: string;
        snippet: string;
        publishedAt: string | null;
    }[];
    clusterId?: string | undefined;
    rank?: number | undefined;
}, {
    cluster: string;
    rowId: string;
    keyword: string;
    intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
    mentions: number;
    recencyScore: number;
    sourcesCount: number;
    domainsCount: number;
    researchScore?: number | undefined;
    topEvidence?: {
        url: string;
        title: string;
        snippet?: string | undefined;
        publishedAt?: string | null | undefined;
    }[] | undefined;
    clusterId?: string | undefined;
    rank?: number | undefined;
}>;
export declare const actionSchema: z.ZodObject<{
    title: z.ZodString;
    priority: z.ZodEnum<["P0", "P1", "P2"]>;
}, "strip", z.ZodTypeAny, {
    title: string;
    priority: "P0" | "P1" | "P2";
}, {
    title: string;
    priority: "P0" | "P1" | "P2";
}>;
export declare const clusterEvidenceSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    title: string;
}, {
    url: string;
    title: string;
}>;
export declare const clusterBundleSchema: z.ZodObject<{
    cluster: z.ZodString;
    topKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recommendedActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        priority: z.ZodEnum<["P0", "P1", "P2"]>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        priority: "P0" | "P1" | "P2";
    }, {
        title: string;
        priority: "P0" | "P1" | "P2";
    }>, "many">>;
    topEvidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        title: string;
    }, {
        url: string;
        title: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    cluster: string;
    topEvidence: {
        url: string;
        title: string;
    }[];
    topKeywords: string[];
    recommendedActions: {
        title: string;
        priority: "P0" | "P1" | "P2";
    }[];
}, {
    cluster: string;
    topEvidence?: {
        url: string;
        title: string;
    }[] | undefined;
    topKeywords?: string[] | undefined;
    recommendedActions?: {
        title: string;
        priority: "P0" | "P1" | "P2";
    }[] | undefined;
}>;
export declare const resultBundleSchema: z.ZodOptional<z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    nextSteps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sources: z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        title: string;
    }, {
        url: string;
        title: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    summary: string;
    nextSteps: string[];
    sources: {
        url: string;
        title: string;
    }[];
}, {
    title: string;
    summary: string;
    nextSteps?: string[] | undefined;
    sources?: {
        url: string;
        title: string;
    }[] | undefined;
}>>;
export declare const researchOutputSchema: z.ZodObject<{
    rows: z.ZodArray<z.ZodObject<{
        rowId: z.ZodString;
        cluster: z.ZodString;
        keyword: z.ZodString;
        intent: z.ZodEnum<["buying", "inspiration", "diy", "informational", "supplier"]>;
        mentions: z.ZodNumber;
        recencyScore: z.ZodNumber;
        researchScore: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        sourcesCount: z.ZodNumber;
        domainsCount: z.ZodNumber;
        topEvidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodString;
            snippet: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            publishedAt: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            title: string;
            snippet: string;
            publishedAt: string | null;
        }, {
            url: string;
            title: string;
            snippet?: string | undefined;
            publishedAt?: string | null | undefined;
        }>, "many">>;
        clusterId: z.ZodOptional<z.ZodString>;
        rank: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        cluster: string;
        rowId: string;
        keyword: string;
        intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
        mentions: number;
        recencyScore: number;
        researchScore: number;
        sourcesCount: number;
        domainsCount: number;
        topEvidence: {
            url: string;
            title: string;
            snippet: string;
            publishedAt: string | null;
        }[];
        clusterId?: string | undefined;
        rank?: number | undefined;
    }, {
        cluster: string;
        rowId: string;
        keyword: string;
        intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
        mentions: number;
        recencyScore: number;
        sourcesCount: number;
        domainsCount: number;
        researchScore?: number | undefined;
        topEvidence?: {
            url: string;
            title: string;
            snippet?: string | undefined;
            publishedAt?: string | null | undefined;
        }[] | undefined;
        clusterId?: string | undefined;
        rank?: number | undefined;
    }>, "many">;
    clusterBundles: z.ZodArray<z.ZodObject<{
        cluster: z.ZodString;
        topKeywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        recommendedActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            priority: z.ZodEnum<["P0", "P1", "P2"]>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            priority: "P0" | "P1" | "P2";
        }, {
            title: string;
            priority: "P0" | "P1" | "P2";
        }>, "many">>;
        topEvidence: z.ZodDefault<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            title: string;
        }, {
            url: string;
            title: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        cluster: string;
        topEvidence: {
            url: string;
            title: string;
        }[];
        topKeywords: string[];
        recommendedActions: {
            title: string;
            priority: "P0" | "P1" | "P2";
        }[];
    }, {
        cluster: string;
        topEvidence?: {
            url: string;
            title: string;
        }[] | undefined;
        topKeywords?: string[] | undefined;
        recommendedActions?: {
            title: string;
            priority: "P0" | "P1" | "P2";
        }[] | undefined;
    }>, "many">;
    resultBundle: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        summary: z.ZodString;
        nextSteps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        sources: z.ZodDefault<z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            title: string;
        }, {
            url: string;
            title: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        summary: string;
        nextSteps: string[];
        sources: {
            url: string;
            title: string;
        }[];
    }, {
        title: string;
        summary: string;
        nextSteps?: string[] | undefined;
        sources?: {
            url: string;
            title: string;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    rows: {
        cluster: string;
        rowId: string;
        keyword: string;
        intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
        mentions: number;
        recencyScore: number;
        researchScore: number;
        sourcesCount: number;
        domainsCount: number;
        topEvidence: {
            url: string;
            title: string;
            snippet: string;
            publishedAt: string | null;
        }[];
        clusterId?: string | undefined;
        rank?: number | undefined;
    }[];
    clusterBundles: {
        cluster: string;
        topEvidence: {
            url: string;
            title: string;
        }[];
        topKeywords: string[];
        recommendedActions: {
            title: string;
            priority: "P0" | "P1" | "P2";
        }[];
    }[];
    resultBundle?: {
        title: string;
        summary: string;
        nextSteps: string[];
        sources: {
            url: string;
            title: string;
        }[];
    } | undefined;
}, {
    rows: {
        cluster: string;
        rowId: string;
        keyword: string;
        intent: "supplier" | "buying" | "inspiration" | "diy" | "informational";
        mentions: number;
        recencyScore: number;
        sourcesCount: number;
        domainsCount: number;
        researchScore?: number | undefined;
        topEvidence?: {
            url: string;
            title: string;
            snippet?: string | undefined;
            publishedAt?: string | null | undefined;
        }[] | undefined;
        clusterId?: string | undefined;
        rank?: number | undefined;
    }[];
    clusterBundles: {
        cluster: string;
        topEvidence?: {
            url: string;
            title: string;
        }[] | undefined;
        topKeywords?: string[] | undefined;
        recommendedActions?: {
            title: string;
            priority: "P0" | "P1" | "P2";
        }[] | undefined;
    }[];
    resultBundle?: {
        title: string;
        summary: string;
        nextSteps?: string[] | undefined;
        sources?: {
            url: string;
            title: string;
        }[] | undefined;
    } | undefined;
}>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;
//# sourceMappingURL=research.output.schema.d.ts.map