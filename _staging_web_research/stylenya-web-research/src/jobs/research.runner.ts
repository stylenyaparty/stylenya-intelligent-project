import type { FastifyBaseLogger } from "fastify";
import { runResearchPipeline } from "../research/research.pipeline.js";
import { persistClusters, persistRowsAndEvidence } from "../services/research.persist.service.js";
import { finalizeRunFailedOnce, finalizeRunSuccessOnce, markRunRunning } from "../services/research.run.service.js";

type ResearchInput = {
    query: string;
    mode: "quick" | "deep";
    market?: string;
    locale?: string;
    geo?: string;
    language?: string;
    topic?: "seasonal" | "product" | "supplier" | "general";
};

type ActiveJob = {
    runId: string;
    startedAt: number;
    status: "RUNNING";
    cancelRequested: boolean;
};

type EnqueuedJob = {
    runId: string;
    input: ResearchInput;
    enqueuedAt: number;
};

function getResearchTimeoutMs(mode: "quick" | "deep") {
    const quick = Number(process.env.RESEARCH_TIMEOUT_MS_QUICK ?? 90_000);
    const deep = Number(process.env.RESEARCH_TIMEOUT_MS_DEEP ?? 180_000);
    return mode === "deep" ? deep : quick;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: "pipeline") {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject({
                name: "PipelineTimeoutError",
                message: `Research ${stage} timed out after ${timeoutMs}ms`,
                timeout: true,
                stage,
            });
        }, timeoutMs);

        promise
            .then((value) => resolve(value))
            .catch((error) => reject(error))
            .finally(() => clearTimeout(timer));
    });
}

export function createResearchRunner(logger: FastifyBaseLogger) {
    const maxConcurrency = Number(process.env.RESEARCH_MAX_CONCURRENCY ?? 2);
    const activeJobs = new Map<string, ActiveJob>();
    const queuedJobs: EnqueuedJob[] = [];
    let isClosed = false;
    let drainScheduled = false;

    const scheduleDrain = () => {
        if (drainScheduled || isClosed) return;
        drainScheduled = true;
        queueMicrotask(() => {
            drainScheduled = false;
            void drainQueue();
        });
    };

    const shouldCancel = (runId: string) => activeJobs.get(runId)?.cancelRequested === true;

    const throwIfCancelled = (runId: string) => {
        if (shouldCancel(runId)) {
            throw {
                name: "RunCancelledError",
                message: "Run cancelled by user",
                cancelled: true,
            };
        }
    };

    const executeJob = async (job: EnqueuedJob) => {
        const timingsMs: Record<string, number | boolean> = {};
        const startedAt = Date.now();

        activeJobs.set(job.runId, {
            runId: job.runId,
            startedAt,
            status: "RUNNING",
            cancelRequested: false,
        });

        await markRunRunning(job.runId, { startedAt });

        try {
            throwIfCancelled(job.runId);
            const timeoutMs = getResearchTimeoutMs(job.input.mode);
            const pipelineResult = await withTimeout(
                runResearchPipeline({
                    prompt: job.input.query,
                    mode: job.input.mode,
                    market: job.input.market ?? job.input.locale ?? job.input.geo ?? "global",
                    language: job.input.language,
                    topic: job.input.topic,
                }),
                timeoutMs,
                "pipeline"
            );

            if (pipelineResult?.timingsMs && typeof pipelineResult.timingsMs === "object") {
                Object.assign(timingsMs, pipelineResult.timingsMs as Record<string, number | boolean>);
            }

            throwIfCancelled(job.runId);
            const rows = Array.isArray(pipelineResult?.rows) ? pipelineResult.rows : [];
            const clusterBundles = Array.isArray(pipelineResult?.clusterBundles)
                ? pipelineResult.clusterBundles
                : undefined;

            const persistStartedAt = Date.now();
            await persistRowsAndEvidence(job.runId, rows);
            await persistClusters(job.runId, clusterBundles, rows);
            timingsMs.persist = Date.now() - persistStartedAt;
            timingsMs.total = Date.now() - startedAt;

            const finalized = await finalizeRunSuccessOnce(job.runId, {
                timingsMs: timingsMs as Record<string, number>,
                resultJson: pipelineResult,
            });

            if (!finalized) {
                logger.warn({ runId: job.runId }, "run already finalized before success");
            }
        } catch (error) {
            timingsMs.total = Date.now() - startedAt;
            const err = error as any;
            const errorJson = {
                name: err?.name ?? "Error",
                message: err?.message ?? "Unexpected research pipeline error",
                ...(typeof err?.code === "string" ? { code: err.code } : {}),
                ...(typeof err?.status === "number" ? { status: err.status } : {}),
                ...(err?.isRateLimit === true ? { isRateLimit: true } : {}),
                ...(err?.timeout === true ? { timeout: true } : {}),
                ...(typeof err?.stage === "string" ? { stage: err.stage } : {}),
                ...(err?.cancelled === true ? { cancelled: true } : {}),
            };

            const finalized = await finalizeRunFailedOnce(job.runId, {
                timingsMs: timingsMs as Record<string, number>,
                errorJson,
            });

            if (finalized) {
                logger.error({ runId: job.runId, error: errorJson }, "web research pipeline failed");
            }
        } finally {
            activeJobs.delete(job.runId);
            scheduleDrain();
        }
    };

    const drainQueue = async () => {
        if (isClosed) return;

        while (activeJobs.size < maxConcurrency && queuedJobs.length > 0) {
            const nextJob = queuedJobs.shift();
            if (!nextJob) break;
            queueMicrotask(() => {
                void executeJob(nextJob);
            });
        }
    };

    const enqueueResearchRun = (runId: string, input: ResearchInput) => {
        if (isClosed) {
            throw new Error("Research runner is shutting down");
        }

        queuedJobs.push({ runId, input, enqueuedAt: Date.now() });
        scheduleDrain();
    };

    const cancel = async (runId: string) => {
        const queuedIndex = queuedJobs.findIndex((job) => job.runId === runId);
        if (queuedIndex >= 0) {
            queuedJobs.splice(queuedIndex, 1);
            await finalizeRunFailedOnce(runId, {
                timingsMs: { total: 0 },
                errorJson: {
                    name: "RunCancelledError",
                    message: "Run cancelled while queued",
                    cancelled: true,
                },
            });
            return { cancelled: true, state: "QUEUED" as const };
        }

        const active = activeJobs.get(runId);
        if (active) {
            active.cancelRequested = true;
            activeJobs.set(runId, active);
            return { cancelled: true, state: "RUNNING" as const };
        }

        return { cancelled: false, state: "UNKNOWN" as const };
    };

    const shutdown = async () => {
        isClosed = true;
    };

    return {
        enqueueResearchRun,
        cancel,
        shutdown,
        getStats: () => ({ active: activeJobs.size, queued: queuedJobs.length, maxConcurrency }),
    };
}

export type ResearchRunner = ReturnType<typeof createResearchRunner>;
