export type ProductTypeMatch = {
    key: string;
    synonyms: string[];
};

export type RelevanceContext = {
    productTypes: ProductTypeMatch[];
    occasionTerms: string[];
    excludeTerms: string[];
};

export type RelevanceResult = {
    filteredSignals: Array<{ keyword: string }>;
    filteredOutCount: number;
    matchedProductTypeKeys: Set<string>;
    matchedOccasionTerms: Set<string>;
    matchedExcludeTerms: Set<string>;
};

export function normalize(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function phraseMatch(keyword: string, phrase: string) {
    if (!keyword || !phrase) return false;
    return keyword.includes(phrase);
}

function normalizeTerms(terms: string[]) {
    return terms.map(normalize).filter(Boolean);
}

export function matchTerms(keywordNorm: string, termsNorm: string[]) {
    if (!keywordNorm) return [];
    return termsNorm.filter((term) => term.length > 0 && phraseMatch(keywordNorm, term));
}

export function matchProductTypes(keywordNorm: string, productTypes: ProductTypeMatch[]) {
    const matched: string[] = [];
    if (!keywordNorm) return matched;
    for (const productType of productTypes) {
        if (productType.synonyms.some((term) => term.length > 0 && phraseMatch(keywordNorm, term))) {
            matched.push(productType.key);
        }
    }
    return matched;
}

export function buildProductTypeMatches(definitions: Array<{ key: string; label: string; synonyms: string[] }>) {
    return definitions.map((definition) => {
        const terms = [definition.label, ...definition.synonyms];
        const normalized = Array.from(new Set(terms.map(normalize).filter(Boolean)));
        return { key: definition.key, synonyms: normalized };
    });
}

export function filterSignals<T extends { keyword: string }>(
    signals: T[],
    context: RelevanceContext,
    mode: "strict" | "broad" | "all"
) {
    if (mode === "all") {
        return {
            filteredSignals: signals,
            filteredOutCount: 0,
            matchedProductTypeKeys: new Set<string>(),
            matchedOccasionTerms: new Set<string>(),
            matchedExcludeTerms: new Set<string>(),
        } satisfies RelevanceResult;
    }

    const productTypesNorm = context.productTypes;
    const occasionNorm = normalizeTerms(context.occasionTerms);
    const excludeNorm = normalizeTerms(context.excludeTerms);

    const filteredSignals: T[] = [];
    let filteredOutCount = 0;
    const matchedProductTypeKeys = new Set<string>();
    const matchedOccasionTerms = new Set<string>();
    const matchedExcludeTerms = new Set<string>();

    for (const signal of signals) {
        const keywordNorm = normalize(signal.keyword ?? "");
        const matchedProductTypes = matchProductTypes(keywordNorm, productTypesNorm);
        const matchedOccasions = matchTerms(keywordNorm, occasionNorm);
        const matchedExcludes = matchTerms(keywordNorm, excludeNorm);

        if (matchedExcludes.length > 0) {
            matchedExcludes.forEach((term) => matchedExcludeTerms.add(term));
            filteredOutCount += 1;
            continue;
        }

        if (matchedProductTypes.length > 0 || matchedOccasions.length > 0) {
            matchedProductTypes.forEach((key) => matchedProductTypeKeys.add(key));
            matchedOccasions.forEach((term) => matchedOccasionTerms.add(term));
            filteredSignals.push(signal);
        } else {
            filteredOutCount += 1;
        }
    }

    return {
        filteredSignals,
        filteredOutCount,
        matchedProductTypeKeys,
        matchedOccasionTerms,
        matchedExcludeTerms,
    };
}
