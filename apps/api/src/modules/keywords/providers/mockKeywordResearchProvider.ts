import type {
    KeywordResearchProvider,
    KeywordResearchSeedInput,
    KeywordSuggestion,
} from "./providerTypes.js";

function hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) % 100000;
    }
    return hash;
}

function scoreFromHash(hash: number) {
    return Math.abs(hash % 101);
}

export class MockKeywordResearchProvider implements KeywordResearchProvider {
    async getSuggestions(input: KeywordResearchSeedInput): Promise<KeywordSuggestion[]> {
        const base = `${input.seed}|${input.marketplace}|${input.language}`;
        const interestScore = scoreFromHash(hashString(`${base}|interest`));
        const competitionScore = scoreFromHash(hashString(`${base}|competition`));
        const relatedKeywords = this.buildRelatedKeywords(input.seed);
        const summary = `Demand for "${input.seed}" shows an interest score of ${interestScore}/100 with competition at ${competitionScore}/100. Best aligned for ${input.marketplace} shoppers searching in ${input.language}.`;

        const suggestions: KeywordSuggestion[] = [
            {
                term: input.seed,
                interestScore,
                competitionScore,
                summary,
                relatedKeywords,
                isSeed: true,
            },
        ];

        for (const related of relatedKeywords) {
            const relatedBase = `${related}|${input.marketplace}|${input.language}`;
            const relatedInterestScore = scoreFromHash(hashString(`${relatedBase}|interest`));
            const relatedCompetitionScore = scoreFromHash(hashString(`${relatedBase}|competition`));
            suggestions.push({
                term: related,
                interestScore: relatedInterestScore,
                competitionScore: relatedCompetitionScore,
                summary: `Demand for "${related}" shows an interest score of ${relatedInterestScore}/100 with competition at ${relatedCompetitionScore}/100.`,
            });
        }

        return suggestions;
    }

    private buildRelatedKeywords(term: string) {
        const base = term.trim();
        return [
            `${base} ideas`,
            `${base} trends`,
            `${base} gift`,
            `${base} decor`,
            `${base} inspiration`,
            `${base} bundle`,
        ];
    }
}
