import { prisma } from "../db/prisma.js";

type CreateRunInput = {
    query: string;
    mode?: "quick" | "deep";
    locale?: string;
    geo?: string;
    language?: string;
};

type RunTimings = Record<string, number | boolean>;

export async function createRunQueued(input: CreateRunInput) {
    return prisma.webResearchRun.create({
        data: {
            query: input.query,
            mode: input.mode ?? "quick",
            locale: input.locale ?? null,
            geo: input.geo ?? null,
            language: input.language ?? null,
            status: "QUEUED",
        },
    });
}

export async function createRunRunning(input: CreateRunInput) {
    return prisma.webResearchRun.create({
        data: {
            query: input.query,
            mode: input.mode ?? "quick",
            locale: input.locale ?? null,
            geo: input.geo ?? null,
            language: input.language ?? null,
            status: "RUNNING",
        },
    });
}

export async function markRunRunning(runId: string, timingsMs?: RunTimings) {
    const result = await prisma.webResearchRun.updateMany({
        where: {
            id: runId,
            status: "QUEUED",
        },
        data: {
            status: "RUNNING",
            ...(timingsMs ? { timingsMs: timingsMs as any } : {}),
        },
    });

    return result.count > 0;
}

export async function finalizeRunSuccessOnce(
    runId: string,
    payload: { timingsMs: RunTimings; resultJson: unknown }
) {
    const result = await prisma.webResearchRun.updateMany({
        where: {
            id: runId,
            status: {
                in: ["RUNNING", "QUEUED"],
            },
        },
        data: {
            status: "SUCCESS",
            timingsMs: payload.timingsMs as any,
            resultJson: payload.resultJson as any,
            errorJson: null,
        },
    });

    return result.count > 0;
}

export async function finalizeRunFailedOnce(
    runId: string,
    payload: { timingsMs: RunTimings; errorJson: unknown }
) {
    const result = await prisma.webResearchRun.updateMany({
        where: {
            id: runId,
            status: {
                in: ["RUNNING", "QUEUED"],
            },
        },
        data: {
            status: "FAILED",
            timingsMs: payload.timingsMs as any,
            errorJson: payload.errorJson as any,
        },
    });

    return result.count > 0;
}

export async function markCancelRequested(runId: string) {
    const run = await prisma.webResearchRun.findUnique({
        where: { id: runId },
        select: { errorJson: true },
    });

    if (!run) return false;

    const base = run.errorJson && typeof run.errorJson === "object" ? (run.errorJson as Record<string, unknown>) : {};

    await prisma.webResearchRun.update({
        where: { id: runId },
        data: {
            errorJson: {
                ...base,
                cancelRequested: true,
            } as any,
        },
    });

    return true;
}
