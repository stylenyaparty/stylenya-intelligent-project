import { z } from "zod";

const sourcesSchema = z.object({
    keywordJobIds: z.array(z.string()).default([]),
    signalIds: z.array(z.string()).default([]),
    productIds: z.array(z.string()).default([]),
});

export const decisionDraftSchema = z.object({
    title: z.string().min(3),
    rationale: z.string().min(3),
    actions: z.array(z.string().min(1)).min(1),
    confidence: z.number().int().min(0).max(100),
    sources: sourcesSchema,
});

export const decisionDraftsResponseSchema = z.object({
    drafts: z.array(decisionDraftSchema).min(1),
});

export type DecisionDraftsResponse = z.infer<typeof decisionDraftsResponseSchema>;
