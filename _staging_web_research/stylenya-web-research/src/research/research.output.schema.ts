import { z } from "zod";

export const evidenceSchema = z.object({
    url: z.string().url(),
    title: z.string().min(1),
    snippet: z.string().optional().default(""),
    publishedAt: z.string().nullable().optional().default(null),
});

export const rowSchema = z.object({
    rowId: z.string().min(1),
    cluster: z.string().min(1),
    keyword: z.string().min(1),
    intent: z.enum(["buying", "inspiration", "diy", "informational", "supplier"]),
    mentions: z.number().int().nonnegative(),
    recencyScore: z.number().min(0).max(1),
    researchScore: z.number().min(0).max(1).optional().default(0),
    sourcesCount: z.number().int().nonnegative(),
    domainsCount: z.number().int().nonnegative(),
    topEvidence: z.array(evidenceSchema).max(2).default([]),

    // opcionales si ya agregaste ranking
    clusterId: z.string().optional(),
    rank: z.number().int().positive().optional(),
});

export const actionSchema = z.object({
    title: z.string().min(1),
    priority: z.enum(["P0", "P1", "P2"]),
});

export const clusterEvidenceSchema = z.object({
    url: z.string().url(),
    title: z.string().min(1),
});

export const clusterBundleSchema = z.object({
    cluster: z.string().min(1),
    topKeywords: z.array(z.string().min(1)).max(5).default([]),
    recommendedActions: z.array(actionSchema).max(3).default([]),
    topEvidence: z.array(clusterEvidenceSchema).max(2).default([]),
});

export const resultBundleSchema = z
    .object({
        title: z.string().min(1),
        summary: z.string().min(1),
        nextSteps: z.array(z.string().min(1)).max(7).default([]),
        sources: z.array(clusterEvidenceSchema).max(7).default([]),
    })
    .optional();

export const researchOutputSchema = z.object({
    rows: z.array(rowSchema),
    clusterBundles: z.array(clusterBundleSchema),
    resultBundle: resultBundleSchema,
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;