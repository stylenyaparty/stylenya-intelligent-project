export type ResearchMode = "quick" | "deep";

export type ResearchTopic = "seasonal" | "product" | "supplier" | "general";

export type WebResearchInput = {
    query: string;
    mode: ResearchMode;
    market?: string;
    locale?: string;
    geo?: string;
    language?: string;
    topic?: ResearchTopic;
};

export type ProviderDocument = {
    url: string;
    title: string;
    snippet?: string;
    publishedAt?: string | null;
    score?: number;
    raw?: unknown;
};

export type WebResearchProvider = {
    search(input: WebResearchInput): Promise<ProviderDocument[]>;
};

export type PipelineEvidence = {
    url: string;
    title?: string;
    snippet?: string;
    publishedAt?: Date | null;
    source?: string;
    rawJson?: unknown;
};

export type PipelineRow = {
    url: string;
    title: string;
    snippet?: string;
    publishedAt?: Date | null;
    score?: number;
    clusterKey: string;
    clusterRank?: number;
    rawJson?: unknown;
    evidences: PipelineEvidence[];
};

export type PipelineCluster = {
    key: string;
    label: string;
    summary?: string;
    rank: number;
    rowCount: number;
    topScore?: number;
    bundleJson?: unknown;
};

export type PipelineResult = {
    rows: PipelineRow[];
    clusters: PipelineCluster[];
    resultBundle: {
        title: string;
        summary: string;
        nextSteps: string[];
        sources: Array<{ url: string; title: string }>;
    };
    timingsMs: Record<string, number>;
};
