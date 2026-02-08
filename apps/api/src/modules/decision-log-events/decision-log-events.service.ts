import { Prisma, type DecisionLogEventType } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";

export async function logDecisionLogEvent(params: {
    eventType: DecisionLogEventType;
    refType: string;
    refId: string;
    meta?: Prisma.InputJsonValue | null;
}) {
    return prisma.decisionLogEvent.create({
        data: {
            eventType: params.eventType,
            refType: params.refType,
            refId: params.refId,
            metaJson:
                params.meta === undefined ? undefined : params.meta ?? Prisma.DbNull,
        },
    });
}
