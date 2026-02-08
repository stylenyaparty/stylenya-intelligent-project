import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";

export type ProductTypeInput = {
    label: string;
    key?: string;
    synonyms?: string[];
    required?: boolean;
};

export type ProductTypeUpdate = {
    label?: string;
    synonyms?: string[];
    required?: boolean;
    status?: "ACTIVE" | "ARCHIVED";
};

function normalizeLabel(label: string) {
    return label.trim().replace(/\s+/g, " ");
}

function normalizeSynonyms(synonyms?: string[]) {
    if (!synonyms) return [];
    const normalized = synonyms
        .map((term) => term.trim().replace(/\s+/g, " ").toLowerCase())
        .filter((term) => term.length > 0);
    return Array.from(new Set(normalized));
}

function generateKey(label: string) {
    const normalized = label
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, "_");
    if (!normalized) {
        throw new AppError(400, "INVALID_KEY", "Unable to generate key from label.");
    }
    return normalized;
}

export async function listProductTypes(status: "active" | "archived" | "all") {
    const where: Prisma.ProductTypeDefinitionWhereInput =
        status === "all"
            ? {}
            : {
                  status: status === "active" ? "ACTIVE" : "ARCHIVED",
              };

    return prisma.productTypeDefinition.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
}

export async function createProductType(input: ProductTypeInput) {
    const label = normalizeLabel(input.label);
    if (!label) {
        throw new AppError(400, "INVALID_LABEL", "Label is required.");
    }
    const key = input.key ? generateKey(input.key) : generateKey(label);
    const synonyms = normalizeSynonyms(input.synonyms);

    const existing = await prisma.productTypeDefinition.findUnique({
        where: { key },
        select: { id: true },
    });
    if (existing) {
        throw new AppError(409, "PRODUCT_TYPE_EXISTS", "Product type already exists.");
    }

    return prisma.productTypeDefinition.create({
        data: {
            key,
            label,
            synonymsJson: synonyms,
            required: input.required ?? false,
            status: "ACTIVE",
        },
    });
}

export async function updateProductType(id: string, updates: ProductTypeUpdate) {
    if (!updates.label && !updates.synonyms && !updates.status && updates.required === undefined) {
        throw new AppError(400, "NO_UPDATES", "No updates provided.");
    }

    const data: Record<string, unknown> = {};
    if (updates.label) {
        const label = normalizeLabel(updates.label);
        if (!label) {
            throw new AppError(400, "INVALID_LABEL", "Label is required.");
        }
        data.label = label;
    }
    if (updates.synonyms) {
        data.synonymsJson = normalizeSynonyms(updates.synonyms);
    }
    if (updates.status) {
        data.status = updates.status;
    }
    if (updates.required !== undefined) {
        data.required = updates.required;
    }

    return prisma.productTypeDefinition.update({
        where: { id },
        data,
    });
}

export async function getActiveProductTypes() {
    const types = await prisma.productTypeDefinition.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { key: true, label: true, synonymsJson: true },
    });

    return types.map((type) => ({
        key: type.key,
        label: type.label,
        synonyms: Array.isArray(type.synonymsJson)
            ? (type.synonymsJson as string[])
            : [],
    }));
}
