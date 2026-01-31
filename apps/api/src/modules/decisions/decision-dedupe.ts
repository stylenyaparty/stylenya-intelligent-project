function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(", ")}]`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
        .map((key) => `${JSON.stringify(key)}: ${stableStringify(record[key])}`)
        .join(", ")}}`;
}

function getWeekBucket(date: Date) {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = utc.getUTCDay();
    const diff = (day + 6) % 7;
    utc.setUTCDate(utc.getUTCDate() - diff);
    return utc.toISOString().slice(0, 10);
}

export function buildDedupeKey(payload: {
    actionType: string;
    targetType?: string | null;
    targetId?: string | null;
    sources?: unknown[];
    asOf?: Date;
}) {
    const sources = payload.sources ?? [];
    const normalizedSources = sources.map(stableStringify).sort();
    const weekBucket = getWeekBucket(payload.asOf ?? new Date());

    return [
        payload.actionType,
        payload.targetType ?? "",
        payload.targetId ?? "",
        weekBucket,
        normalizedSources.join(", "),
    ].join("|");
}
