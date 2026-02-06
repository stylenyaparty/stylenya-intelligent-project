export function normalize(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function matchesAny(keywordNorm: string, seedsNorm: string[]) {
    if (!keywordNorm) return false;
    return seedsNorm.some((seed) => seed.length > 0 && keywordNorm.includes(seed));
}

export function filterSignals<T extends { keyword: string }>(
    signals: T[],
    includeSeeds: string[],
    excludeSeeds: string[]
) {
    const includeNorm = includeSeeds.map(normalize).filter(Boolean);
    const excludeNorm = excludeSeeds.map(normalize).filter(Boolean);

    const filteredSignals: T[] = [];
    let filteredOutCount = 0;

    for (const signal of signals) {
        const keywordNorm = normalize(signal.keyword ?? "");
        const includeMatch = includeNorm.length === 0 || matchesAny(keywordNorm, includeNorm);
        const excludeMatch = excludeNorm.length > 0 && matchesAny(keywordNorm, excludeNorm);

        if (includeMatch && !excludeMatch) {
            filteredSignals.push(signal);
        } else {
            filteredOutCount += 1;
        }
    }

    return { filteredSignals, filteredOutCount };
}
