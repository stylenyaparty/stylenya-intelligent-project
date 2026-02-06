import { prisma } from "../../infrastructure/db/prisma.js";
import type { DecisionLogEventType } from "@prisma/client";

export async function logDecisionLogEvent(params: {
    eventType: DecisionLogEventType;
    refType: string;
    refId: string;
    meta?: Record<string, unknown> | null;
}) {
    return prisma.decisionLogEvent.create({
        data: {
            eventType: params.eventType,
            refType: params.refType,
            refId: params.refId,
            metaJson: params.meta ?? undefined,
        },
    });
}
