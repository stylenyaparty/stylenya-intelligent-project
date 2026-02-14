import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../interfaces/http/middleware/auth";
import {
    deleteConfirmSchema,
    productCreateSchema,
    productListQuerySchema,
    productUpdateSchema,
} from "./products.schemas";
import {
    archiveProduct,
    createProduct,
    deleteProduct,
    detectCsvSource,
    extractMultipartFile,
    importEtsy,
    importShopify,
    listProducts,
    parseCsvFile,
    restoreProduct,
    updateProduct,
} from "./products.service";

export async function productsRoutes(app: FastifyInstance) {
    app.get("/products", { preHandler: requireAuth }, async (request, reply) => {
        const query = productListQuerySchema.safeParse(request.query);
        if (!query.success) {
            return reply.code(400).send({ error: "Invalid product query" });
        }
        const products = await listProducts({
            ...query.data,
            statusScope: query.data.statusScope ?? "active",
        });
        return reply.send({ ok: true, ...products });
    });

    app.post("/products", { preHandler: requireAuth }, async (request, reply) => {
        try {
            const body = productCreateSchema.parse(request.body);
            const product = await createProduct(body);
            return reply.code(201).send({ ok: true, product });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid product payload";
            return reply.code(400).send({ error: message });
        }
    });

    app.patch("/products/:id", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        try {
            const body = productUpdateSchema.parse(request.body);
            const product = await updateProduct(params.id, body);
            if (!product) {
                return reply.code(404).send({ error: "Product not found" });
            }
            return reply.send({ ok: true, product });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid product update";
            return reply.code(400).send({ error: message });
        }
    });

    app.post("/products/:id/archive", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        const result = await archiveProduct(params.id);
        if (!result) {
            return reply.code(404).send({ error: "Product not found" });
        }
        if (result === "ALREADY_ARCHIVED") {
            return reply.code(409).send({ error: "Product already archived" });
        }
        return reply.send({ ok: true, product: result });
    });

    app.post("/products/:id/restore", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        const result = await restoreProduct(params.id);
        if (!result) {
            return reply.code(404).send({ error: "Product not found" });
        }
        if (result === "NOT_ARCHIVED") {
            return reply.code(409).send({ error: "Product is not archived" });
        }
        return reply.send({ ok: true, product: result });
    });

    app.delete("/products/:id", { preHandler: requireAuth }, async (request, reply) => {
        const params = request.params as { id: string };
        try {
            deleteConfirmSchema.parse(request.body);
        } catch (error) {
            return reply.code(400).send({ error: "Delete confirmation required" });
        }
        const result = await deleteProduct(params.id);
        if (!result) {
            return reply.code(404).send({ error: "Product not found" });
        }
        return reply.send({ ok: true });
    });

    app.post(
        "/products/import-csv",
        { preHandler: requireAuth },
        async (request, reply) => {
            const multipartFile =
                typeof (request as { file?: () => Promise<{ toBuffer: () => Promise<Buffer> }> }).file ===
                "function"
                    ? await (request as { file: () => Promise<{ toBuffer: () => Promise<Buffer> }> }).file()
                    : null;

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

            const contents = file.buffer.toString("utf8");

            const { headers, rows } = parseCsvFile(contents);
            const source = detectCsvSource(headers);

            if (!source) {
                return reply.code(400).send({
                    code: "CSV_INVALID",
                    message: "Unsupported CSV format",
                    detectedHeaders: headers,
                });
            }

            const result =
                source === "SHOPIFY"
                    ? await importShopify(rows, headers)
                    : await importEtsy(rows, headers);

            return reply.send(result);
        }
    );
}
