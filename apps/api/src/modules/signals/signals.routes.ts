import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../interfaces/http/middleware/auth.js";
import { isAppError } from "../../types/app-error.js";
import {
    importGkpCsv,
    listSignalBatches,
    listSignals,
    listTopSignals,
} from "./signals.service.js";
import { extractMultipartFile } from "../products/products.service.js";

const signalListQuerySchema = z.object({
    batchId: z.string().optional(),
    source: z.string().optional(),
    q: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    offset: z.coerce.number().int().optional(),
});

export async function signalsRoutes(app: FastifyInstance) {
    app.post(
        "/signals/upload",
        { preHandler: requireAuth },
        async (request, reply) => {
            let multipartFile: { toBuffer: () => Promise<Buffer> } | null = null;
            const isMultipart =
                typeof (request as { isMultipart?: () => boolean }).isMultipart === "function"
                    ? (request as { isMultipart: () => boolean }).isMultipart()
                    : false;
            if (isMultipart) {
                multipartFile = await (request as {
                    file: () => Promise<{ toBuffer: () => Promise<Buffer> }>;
                }).file();
            }

            const rawBody = request.body as unknown;
            let buffer = Buffer.isBuffer(rawBody)
                ? rawBody
                : rawBody instanceof Uint8Array
                    ? Buffer.from(rawBody)
                    : typeof rawBody === "string"
                        ? Buffer.from(rawBody, "utf8")
                        : null;

            if (!buffer && !multipartFile) {
                const chunks: Buffer[] = [];
                for await (const chunk of request.raw) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                if (chunks.length > 0) {
                    buffer = Buffer.concat(chunks);
                }
            }

            const file = multipartFile
                ? {
                    filename: "upload.csv",
                    buffer: await multipartFile.toBuffer(),
                }
                : buffer
                    ? extractMultipartFile(buffer, request.headers["content-type"], "file")
                    : null;

            if (!file) {
                return reply.code(400).send({ error: "File is required" });
            }

            if (file.buffer.length > 20 * 1024 * 1024) {
                return reply.code(413).send({ error: "File exceeds 20MB upload limit." });
            }

            try {
                const result = await importGkpCsv(file.buffer, file.filename);
                return reply.send(result);
            } catch (error) {
                if (isAppError(error)) {
                    return reply
                        .code(error.statusCode)
                        .send({ code: error.code, message: error.message, details: error.details });
                }
                throw error;
            }
        }
    );

    app.get("/signals/batches", { preHandler: requireAuth }, async () => {
        const batches = await listSignalBatches();
        return { ok: true, batches };
    });

    app.get("/signals", { preHandler: requireAuth }, async (request, reply) => {
        const query = signalListQuerySchema.safeParse(request.query ?? {});
        if (!query.success) {
            return reply.code(400).send({ error: "Invalid signals query" });
        }

        const signals = await listSignals(query.data);
        return reply.send({ ok: true, signals });
    });

    app.get("/signals/latest", { preHandler: requireAuth }, async (request) => {
        const limit = Number((request.query as { limit?: string })?.limit ?? 20);
        const signals = await listTopSignals(limit);
        return { ok: true, signals };
    });
}
