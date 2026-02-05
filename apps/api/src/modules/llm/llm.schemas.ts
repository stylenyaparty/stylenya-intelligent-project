import { z } from "zod";

export const decisionDraftSchema = z.object({
    title: z.string().min(3),
    keywords: z.array(z.string().min(1)).min(1),
    why_now: z.string().min(3),
    risk_notes: z.string().min(3),
    next_steps: z.array(z.string().min(1)).min(1),
});

export const decisionDraftsResponseSchema = z.object({
    drafts: z.array(decisionDraftSchema).min(1),
});

export type DecisionDraftsResponse = z.infer<typeof decisionDraftsResponseSchema>;
