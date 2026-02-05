import crypto from "node:crypto";
import { AppError } from "../../../types/app-error.js";

/**
 * Supported GKP export format: UTF-16 (tab-separated), two metadata rows, header on line 3,
 * columns like "Keyword", "Avg. monthly searches", "Top of page bid (low range)",
 * optional monthly "Searches: Mon YYYY" fields, and percent fields such as "-90%".
 */

const KEYWORD_HEADERS = [
    "keyword",
    "keyword text",
    "search term",
    "palabra clave",
    "termino de busqueda",
    "término de búsqueda",
];
const AVG_MONTHLY_HEADERS = ["avg monthly searches", "avg. monthly searches"];
const COMPETITION_HEADERS = ["competition"];
const COMPETITION_INDEX_HEADERS = ["competition (indexed value)"];
const CPC_LOW_HEADERS = ["top of page bid (low range)"];
const CPC_HIGH_HEADERS = ["top of page bid (high range)"];
const CHANGE_3M_HEADERS = ["three month change", "3 month change", "3-month change"];
const CHANGE_YOY_HEADERS = ["yoy change", "yo y change", "yo/y change", "yoy (change)"];
const CURRENCY_HEADERS = ["currency", "currency code"];
const GEO_HEADERS = ["geo", "location", "country"];
const LANGUAGE_HEADERS = ["language"];

const EMPTY_VALUES = new Set(["", "-", "—", "–", "n/a"]);

const MONTHS: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
};

function normalizeHeader(value: string) {
    const cleaned = value.replace(/^\uFEFF/, "").trim();
    return cleaned
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function normalizeKeyword(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectDelimiter(headerLine: string) {
    if (headerLine.includes("\t")) return "\t";
    return ",";
}

function decodeBuffer(buffer: Buffer) {
    if (buffer.length >= 2) {
        if (buffer[0] === 0xff && buffer[1] === 0xfe) {
            return { text: buffer.toString("utf16le"), encoding: "utf16le" as const };
        }
        if (buffer[0] === 0xfe && buffer[1] === 0xff) {
            const swapped = Buffer.from(buffer);
            swapped.swap16();
            return { text: swapped.toString("utf16le"), encoding: "utf16be" as const };
        }
    }

    const sniff = buffer.subarray(0, Math.min(buffer.length, 100));
    const hasNull = sniff.some((byte) => byte === 0x00);
    if (hasNull) {
        return { text: buffer.toString("utf16le"), encoding: "utf16le" as const };
    }

    return { text: buffer.toString("utf8"), encoding: "utf8" as const };
}

function parseDelimitedLine(line: string, delimiter: string) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            values.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
}

function isEmptyValue(value?: string | null) {
    if (value === undefined || value === null) return true;
    return EMPTY_VALUES.has(value.trim());
}

function parseLocaleNumber(raw: string) {
    let value = raw.trim();
    if (!value) return null;
    value = value.replace(/[^0-9,.-]/g, "");
    if (!value) return null;

    const commaCount = (value.match(/,/g) || []).length;
    const dotCount = (value.match(/\./g) || []).length;

    if (commaCount > 0 && dotCount > 0) {
        if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
            value = value.replace(/\./g, "").replace(/,/g, ".");
        } else {
            value = value.replace(/,/g, "");
        }
    } else if (commaCount > 0 && dotCount === 0) {
        if (commaCount > 1) {
            value = value.replace(/,/g, "");
        } else {
            const [left, right] = value.split(",");
            if (right.length === 3) {
                value = left + right;
            } else {
                value = `${left}.${right}`;
            }
        }
    } else if (dotCount > 1) {
        const lastDot = value.lastIndexOf(".");
        const decimals = value.slice(lastDot + 1);
        const intPart = value.slice(0, lastDot).replace(/\./g, "");
        value = `${intPart}.${decimals}`;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseRange(value: string) {
    const match = value.match(/([0-9.,]+)\s*[–-]\s*([0-9.,]+)/);
    if (!match) return null;
    const min = parseLocaleNumber(match[1]);
    const max = parseLocaleNumber(match[2]);
    if (min === null || max === null) return null;
    return { min, max, midpoint: (min + max) / 2 };
}

function parseNullableNumber(value?: string | null) {
    if (!value || isEmptyValue(value)) return null;

    const trimmed = value.trim();
    if (trimmed.startsWith("<")) {
        const threshold = parseLocaleNumber(trimmed.slice(1));
        if (threshold === null) return null;
        return threshold / 2;
    }

    const range = parseRange(trimmed);
    if (range) return range.midpoint;

    return parseLocaleNumber(trimmed);
}

function parseNullableInt(value?: string | null) {
    const parsed = parseNullableNumber(value);
    if (parsed === null) return null;
    return Math.round(parsed);
}

function parseNullablePercent(value?: string | null) {
    if (!value || isEmptyValue(value)) return null;
    const trimmed = value.replace(/%/g, "").trim();
    const parsed = parseLocaleNumber(trimmed);
    if (parsed === null) return null;
    return parsed / 100;
}

function parseCompetition(value?: string | null) {
    if (!value || isEmptyValue(value)) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith("low")) return "LOW";
    if (normalized.startsWith("med")) return "MEDIUM";
    if (normalized.startsWith("high")) return "HIGH";
    return null;
}

function findHeaderIndex(headers: string[], candidates: string[]) {
    const normalizedCandidates = new Set(candidates.map((candidate) => normalizeHeader(candidate)));
    return headers.findIndex((header) => normalizedCandidates.has(normalizeHeader(header)));
}

function extractMonthlyKey(header: string) {
    const match = header.match(/searches:\s*([A-Za-z]+)\s+(\d{4})/i);
    if (!match) return null;
    const monthToken = match[1].toLowerCase();
    const year = match[2];
    const month = MONTHS[monthToken];
    if (!month) return null;
    return `${year}-${month}`;
}

export type ParsedSignalRow = {
    keyword: string;
    keywordNormalized: string;
    geo?: string | null;
    language?: string | null;
    avgMonthlySearches: number | null;
    competitionLevel: string | null;
    competitionIndex: number | null;
    cpcLow: number | null;
    cpcHigh: number | null;
    change3mPct: number | null;
    changeYoYPct: number | null;
    currency: string | null;
    monthlySearches: Record<string, number> | null;
    rawRowHash: string;
    rawRow: Record<string, string | undefined>;
};

export type ParsedGkpCsv = {
    rows: ParsedSignalRow[];
    totalRows: number;
    skippedRows: number;
    columnsDetected: string[];
    warnings: string[];
    encoding: string;
    delimiter: string;
};

export function parseGkpCsvBuffer(buffer: Buffer): ParsedGkpCsv {
    const { text, encoding } = decodeBuffer(buffer);
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");

    if (lines.length < 3) {
        throw new AppError(400, "CSV_MALFORMED", "GKP CSV is missing header rows.");
    }

    const dataLines = lines.slice(2);
    const headerLineIndex = dataLines.findIndex((line) => line.trim() !== "");
    if (headerLineIndex === -1) {
        throw new AppError(400, "CSV_MALFORMED", "GKP CSV is missing header rows.");
    }

    const headerLine = dataLines[headerLineIndex];
    const delimiter = detectDelimiter(headerLine);
    const headers = parseDelimitedLine(headerLine, delimiter).map((header) =>
        header.replace(/^\uFEFF/, "").trim()
    );

    const keywordIndex = findHeaderIndex(headers, KEYWORD_HEADERS);
    if (keywordIndex === -1) {
        throw new AppError(400, "CSV_MISSING_KEYWORD", "CSV missing keyword column.", {
            columnsDetected: headers,
        });
    }

    const avgMonthlyIndex = findHeaderIndex(headers, AVG_MONTHLY_HEADERS);
    const competitionIndex = findHeaderIndex(headers, COMPETITION_HEADERS);
    const competitionValueIndex = findHeaderIndex(headers, COMPETITION_INDEX_HEADERS);
    const cpcLowIndex = findHeaderIndex(headers, CPC_LOW_HEADERS);
    const cpcHighIndex = findHeaderIndex(headers, CPC_HIGH_HEADERS);
    const change3mIndex = findHeaderIndex(headers, CHANGE_3M_HEADERS);
    const changeYoYIndex = findHeaderIndex(headers, CHANGE_YOY_HEADERS);
    const currencyIndex = findHeaderIndex(headers, CURRENCY_HEADERS);
    const geoIndex = findHeaderIndex(headers, GEO_HEADERS);
    const languageIndex = findHeaderIndex(headers, LANGUAGE_HEADERS);

    const monthlyColumns = headers
        .map((header, index) => ({ header, index, key: extractMonthlyKey(header) }))
        .filter((entry): entry is { header: string; index: number; key: string } => Boolean(entry.key));

    const rows: ParsedSignalRow[] = [];
    let skippedRows = 0;

    const dataStart = headerLineIndex + 1;
    for (let lineIndex = dataStart; lineIndex < dataLines.length; lineIndex += 1) {
        const line = dataLines[lineIndex];
        if (!line || !line.trim()) continue;
        const values = parseDelimitedLine(line, delimiter);
        const keywordRaw = values[keywordIndex]?.trim();
        if (!keywordRaw || isEmptyValue(keywordRaw)) {
            skippedRows += 1;
            continue;
        }

        const keywordNormalized = normalizeKeyword(keywordRaw);
        if (!keywordNormalized) {
            skippedRows += 1;
            continue;
        }

        const rawRow: Record<string, string | undefined> = {};
        headers.forEach((header, idx) => {
            rawRow[header] = values[idx];
        });

        const monthlySearches: Record<string, number> = {};
        for (const column of monthlyColumns) {
            const value = parseNullableInt(values[column.index]);
            if (value !== null) {
                monthlySearches[column.key] = value;
            }
        }

        const rowForHash = headers.map((header) => rawRow[header] ?? "").join("\u0001");
        const rawRowHash = crypto.createHash("sha256").update(rowForHash).digest("hex");

        rows.push({
            keyword: keywordRaw,
            keywordNormalized,
            geo: geoIndex >= 0 ? values[geoIndex]?.trim() || null : null,
            language: languageIndex >= 0 ? values[languageIndex]?.trim() || null : null,
            avgMonthlySearches: avgMonthlyIndex >= 0 ? parseNullableInt(values[avgMonthlyIndex]) : null,
            competitionLevel: competitionIndex >= 0 ? parseCompetition(values[competitionIndex]) : null,
            competitionIndex:
                competitionValueIndex >= 0 ? parseNullableNumber(values[competitionValueIndex]) : null,
            cpcLow: cpcLowIndex >= 0 ? parseNullableNumber(values[cpcLowIndex]) : null,
            cpcHigh: cpcHighIndex >= 0 ? parseNullableNumber(values[cpcHighIndex]) : null,
            change3mPct: change3mIndex >= 0 ? parseNullablePercent(values[change3mIndex]) : null,
            changeYoYPct: changeYoYIndex >= 0 ? parseNullablePercent(values[changeYoYIndex]) : null,
            currency: currencyIndex >= 0 ? values[currencyIndex]?.trim() || null : null,
            monthlySearches: Object.keys(monthlySearches).length > 0 ? monthlySearches : null,
            rawRowHash,
            rawRow,
        });
    }

    if (rows.length === 0) {
        throw new AppError(400, "CSV_NO_KEYWORDS", "No valid keyword rows found in CSV.");
    }

    const warnings: string[] = [];
    if (monthlyColumns.length === 0) {
        warnings.push("No monthly search columns detected.");
    }

    return {
        rows,
        totalRows: Math.max(0, dataLines.length - dataStart),
        skippedRows,
        columnsDetected: headers,
        warnings,
        encoding,
        delimiter,
    };
}
