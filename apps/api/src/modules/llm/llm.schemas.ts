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

export const expandDecisionDraftResponseSchema = z.object({
    expanded: z.object({
        objective: z.string().min(1),
        checklist: z.array(z.string().min(1)).min(5).max(12),
        seo: z.object({
            titleIdeas: z.array(z.string().min(1)).min(3).max(6),
            tagIdeas: z.array(z.string().min(1)).min(10).max(20),
            descriptionBullets: z.array(z.string().min(1)).min(5).max(10),
        }),
        assetsNeeded: z.array(z.string().min(1)).min(3).max(8),
        twoWeekPlan: z.object({
            week1: z.array(z.string().min(1)).min(3).max(7),
            week2: z.array(z.string().min(1)).min(3).max(7),
        }),
        risks: z.array(z.string().min(1)).min(2).max(5),
        successMetrics: z.array(z.string().min(1)).min(3).max(6),
    }),
});

export type ExpandDecisionDraftResponse = z.infer<typeof expandDecisionDraftResponseSchema>;
