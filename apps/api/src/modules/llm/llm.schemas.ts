import { z } from "zod";

export const decisionDraftSchema = z.object({
    title: z.string().min(3),
    rationale: z.string().min(3),
    recommendedActions: z.array(z.string().min(1)).min(1),
    confidence: z.number().min(0).max(100),
});

export const decisionDraftsResponseSchema = z.object({
    drafts: z.array(decisionDraftSchema).min(1),
});

export type DecisionDraftsResponse = z.infer<typeof decisionDraftsResponseSchema>;
