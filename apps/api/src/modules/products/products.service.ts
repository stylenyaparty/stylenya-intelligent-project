import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma";

export type ProductStatusScope = "active" | "draft" | "archived" | "all";

export type CsvImportResult = {
    source: "SHOPIFY" | "ETSY";
    status: "SUCCESS" | "PARTIAL" | "FAILED";
    created: number;
    updated: number;
    skipped: number;
    skippedVariants: number;
    forReview: number;
    message: string;
};

type ShopifyRow = {
    handle: string;
    title: string;
    type: string;
    status: "ACTIVE" | "DRAFT" | "ARCHIVED";
};

const SHOPIFY_HEADERS = ["Handle", "Title", "Status"] as const;
const ETSY_HEADERS = ["TITLE", "QUANTITY"] as const;

export async function listProducts(params: {
    statusScope?: ProductStatusScope;
    search?: string;
    source?: "SHOPIFY" | "ETSY" | "MANUAL";
    status?: "ACTIVE" | "DRAFT" | "ARCHIVED" | "REVIEW";
    q?: string;
    page: number;
    pageSize: number;
}) {
    const filters: Prisma.ProductWhereInput[] = [];

    if (params.status) {
        filters.push({ status: params.status });
    } else if (params.statusScope === "active") {
        filters.push({ status: "ACTIVE", archivedAt: null });
    } else if (params.statusScope === "draft") {
        filters.push({ status: "DRAFT", archivedAt: null });
    } else if (params.statusScope === "archived") {
        filters.push({ OR: [{ archivedAt: { not: null } }, { status: "ARCHIVED" }] });
    }

    if (params.source) {
        filters.push({ productSource: params.source });
    }

    const queryText = params.q ?? params.search;
    if (queryText) {
        filters.push({
            OR: [
                { name: { contains: queryText, mode: "insensitive" } },
                { productType: { contains: queryText, mode: "insensitive" } },
            ],
        });
    }

    const where = filters.length > 0 ? { AND: filters } : undefined;

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip: (params.page - 1) * params.pageSize,
            take: params.pageSize,
        }),
        prisma.product.count({ where }),
    ]);

    return {
        products,
        pagination: {
            page: params.page,
            pageSize: params.pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
        },
    };
}

async function upsertShopifyProduct(product: ShopifyRow) {
    const existing = await prisma.product.findFirst({
        where: {
            productSource: "SHOPIFY",
            shopifyHandle: product.handle,
        },
    });

    const data = {
        name: product.title,
        productType: product.type || "unknown",
        status: product.status,
        archivedAt: product.status === "ARCHIVED" ? new Date() : null,
        shopifyHandle: product.handle,
        shopifyProductId: product.handle,
    } as const;

    if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        return "updated" as const;
    }

    await prisma.product.create({
        data: {
            ...data,
            productSource: "SHOPIFY",
            seasonality: "NONE",
        },
    });
    return "created" as const;
}

export async function createProduct(data: {
    name: string;
    productSource: "SHOPIFY" | "ETSY" | "MANUAL";
    productType: string;
    status: "ACTIVE" | "DRAFT" | "ARCHIVED" | "REVIEW";
    seasonality: string;
}) {
    return prisma.product.create({
        data: {
            name: data.name,
            productSource: data.productSource,
            productType: data.productType,
            status: data.status,
            seasonality: data.seasonality as any,
        },
    });
}

export async function updateProduct(
    id: string,
    data: {
        name?: string;
        productType?: string;
        status?: "ACTIVE" | "DRAFT" | "ARCHIVED" | "REVIEW";
        seasonality?: string;
    }
) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.product.update({
        where: { id },
        data: {
            ...(data.name ? { name: data.name } : {}),
            ...(data.productType ? { productType: data.productType } : {}),
            ...(data.status ? { status: data.status } : {}),
            ...(data.seasonality ? { seasonality: data.seasonality as any } : {}),
        },
    });
}

export async function archiveProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return null;
    if (existing.archivedAt) return "ALREADY_ARCHIVED";

    return prisma.product.update({
        where: { id },
        data: { archivedAt: new Date() },
    });
}

export async function restoreProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return null;
    if (!existing.archivedAt) return "NOT_ARCHIVED";

    return prisma.product.update({
        where: { id },
        data: { archivedAt: null },
    });
}

export async function deleteProduct(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return null;
    await prisma.product.delete({ where: { id } });
    return existing;
}

export function extractMultipartFile(
    body: Buffer,
    contentType: string | undefined,
    fieldName: string
) {
    if (!contentType) return null;
    const match = contentType.match(/boundary=([^;]+)/i);
    if (!match) return null;

    const boundary = match[1]?.replace(/"/g, "");
    if (!boundary) return null;

    const delimiter = `--${boundary}`;
    const bodyString = body.toString("latin1");
    const parts = bodyString.split(delimiter);

    for (const part of parts) {
        if (!part || part === "--\r\n" || part === "--") continue;
        const trimmed = part.startsWith("\r\n") ? part.slice(2) : part;
        const headerEnd = trimmed.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        const rawHeaders = trimmed.slice(0, headerEnd);
        const content = trimmed.slice(headerEnd + 4);

        const dispositionMatch = rawHeaders.match(
            /content-disposition:.*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i
        );
        if (!dispositionMatch) continue;
        const name = dispositionMatch[1];
        const filename = dispositionMatch[2];

        if (name !== fieldName) continue;

        let payload = content;
        if (payload.endsWith("\r\n")) {
            payload = payload.slice(0, -2);
        }
        if (payload.endsWith("--")) {
            payload = payload.slice(0, -2);
        }

        return {
            filename: filename ?? "upload.csv",
            buffer: Buffer.from(payload, "latin1"),
        };
    }

    return null;
}

export function parseCsvFile(contents: string) {
    const sanitized = contents.replace(/^\uFEFF/, "");
    const [headerLine] = sanitized.split(/\r?\n/);
    const delimiter = detectDelimiter(headerLine);
    const rows = parseCsvRows(sanitized, delimiter);
    const headers = rows.shift()?.map((value) => value.trim()) ?? [];

    return { headers, rows, delimiter };
}

export function detectCsvSource(headers: string[]) {
    const headerSet = new Set(headers);
    const isShopify = SHOPIFY_HEADERS.every((header) => headerSet.has(header));
    const isEtsy = ETSY_HEADERS.every((header) => headerSet.has(header));

    if (isShopify) return "SHOPIFY" as const;
    if (isEtsy) return "ETSY" as const;
    return null;
}

export async function importShopify(rows: string[][], headers: string[]): Promise<CsvImportResult> {
    const handleIndex = headers.indexOf("Handle");
    const titleIndex = headers.indexOf("Title");
    const statusIndex = headers.indexOf("Status");
    const typeIndex = headers.indexOf("Type");

    const productsByHandle = new Map<string, string[][]>();
    let skipped = 0;

    for (const row of rows) {
        const handle = row[handleIndex]?.trim();
        if (!handle) {
            skipped += 1;
            continue;
        }
        const existing = productsByHandle.get(handle) ?? [];
        existing.push(row);
        productsByHandle.set(handle, existing);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let forReview = 0;

    for (const [handle, groupedRows] of productsByHandle.entries()) {
        const title = firstNonEmpty(groupedRows, titleIndex);

        if (!title) {
            forReview += 1;
            await prisma.product.upsert({
                where: {
                    productSource_shopifyHandle: {
                        productSource: "SHOPIFY",
                        shopifyHandle: handle,
                    },
                },
                create: {
                    name: `Review: ${handle}`,
                    productSource: "SHOPIFY",
                    productType: "unknown",
                    status: "REVIEW",
                    seasonality: "NONE",
                    shopifyHandle: handle,
                    shopifyProductId: handle,
                    importNotes: JSON.stringify({
                        missingFields: ["Title"],
                        handle,
                    }),
                },
                update: {
                    status: "REVIEW",
                    importNotes: JSON.stringify({
                        missingFields: ["Title"],
                        handle,
                    }),
                },
            });
            continue;
        }

        const product: ShopifyRow = {
            handle,
            title,
            type: firstNonEmpty(groupedRows, typeIndex) || "unknown",
            status: mapShopifyStatus(firstNonEmpty(groupedRows, statusIndex)),
        };

        const result = await upsertShopifyProduct(product);
        if (result === "created") {
            createdCount += 1;
        } else {
            updatedCount += 1;
        }
    }

    const skippedVariants = Math.max(0, rows.length - productsByHandle.size);
    const status =
        forReview === 0
            ? "SUCCESS"
            : createdCount + updatedCount > 0
                ? "PARTIAL"
                : "FAILED";

    return {
        source: "SHOPIFY",
        status,
        created: createdCount,
        updated: updatedCount,
        skipped,
        skippedVariants,
        forReview,
        message: `Imported ${createdCount + updatedCount} Shopify products from ${productsByHandle.size} handles`,
    };
}

export async function importEtsy(rows: string[][], headers: string[]): Promise<CsvImportResult> {
    const titleIndex = headers.indexOf("TITLE");
    const quantityIndex = headers.indexOf("QUANTITY");
    const skuIndex = headers.indexOf("SKU");

    let skipped = 0;
    let createdCount = 0;
    let updatedCount = 0;

    for (let idx = 0; idx < rows.length; idx += 1) {
        const row = rows[idx];
        const rowNumber = idx + 2;
        const title = row[titleIndex]?.trim();

        if (!title) {
            skipped += 1;
            continue;
        }

        const skuRaw = skuIndex >= 0 ? row[skuIndex]?.trim() : undefined;
        const quantityRaw = quantityIndex >= 0 ? row[quantityIndex]?.trim() : undefined;

        const listingId = skuRaw
            ? skuRaw
            : `ETSY_HASH_${crypto.createHash("sha1").update(title).digest("hex")}`;

        const parsedQuantity = quantityRaw ? Number(quantityRaw) : NaN;
        const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : null;
        const status = quantity && quantity > 0 ? "ACTIVE" : "DRAFT";

        const existing = await prisma.product.findFirst({
            where: {
                productSource: "ETSY",
                etsyListingId: listingId,
            },
        });

        await prisma.product.upsert({
            where: {
                productSource_etsyListingId: {
                    productSource: "ETSY",
                    etsyListingId: listingId,
                },
            },
            update: {
                name: title,
                productType: "unknown",
                status,
            },
            create: {
                name: title,
                productSource: "ETSY",
                productType: "unknown",
                status,
                seasonality: "NONE",
                etsyListingId: listingId,
            },
        });

        if (existing) {
            updatedCount += 1;
        } else {
            createdCount += 1;
        }
    }

    return {
        source: "ETSY",
        status: "SUCCESS",
        created: createdCount,
        updated: updatedCount,
        skipped,
        skippedVariants: 0,
        forReview: 0,
        message: `Imported ${createdCount + updatedCount} Etsy products`,
    };
}

function firstNonEmpty(rows: string[][], index: number) {
    if (index < 0) return "";
    for (const row of rows) {
        const value = row[index]?.trim();
        if (value) return value;
    }
    return "";
}

function mapShopifyStatus(value?: string) {
    const normalized = value?.toLowerCase();
    if (normalized === "active") return "ACTIVE" as const;
    if (normalized === "draft") return "DRAFT" as const;
    if (normalized === "archived") return "ARCHIVED" as const;
    return "DRAFT" as const;
}

function detectDelimiter(headerLine: string): "," | ";" {
    let commaCount = 0;
    let semicolonCount = 0;
    let inQuotes = false;

    for (let i = 0; i < headerLine.length; i += 1) {
        const char = headerLine[i];
        if (char === '"') {
            const nextChar = headerLine[i + 1];
            if (inQuotes && nextChar === '"') {
                i += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes) {
            if (char === ",") commaCount += 1;
            if (char === ";") semicolonCount += 1;
        }
    }

    return semicolonCount > commaCount ? ";" : ",";
}

function parseCsvRows(contents: string, delimiter: "," | ";") {
    const rows: string[][] = [];
    let currentField = "";
    let currentRow: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < contents.length; i += 1) {
        const char = contents[i];
        const nextChar = contents[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && (char === "\n" || char === "\r")) {
            if (char === "\r" && nextChar === "\n") {
                i += 1;
            }
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = "";
            continue;
        }

        if (!inQuotes && char === delimiter) {
            currentRow.push(currentField);
            currentField = "";
            continue;
        }

        currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    return rows.filter((row) => row.some((value) => value.trim() !== ""));
}
