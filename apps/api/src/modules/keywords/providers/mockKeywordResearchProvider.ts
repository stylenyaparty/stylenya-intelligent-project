type ResearchInput = {
    term: string;
    marketplace: string;
    language: string;
};

type ResearchResult = {
    summary: string;
    interestScore: number;
    competitionScore: number;
    relatedKeywords: string[];
};

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

export class MockKeywordResearchProvider {
    research(input: ResearchInput): ResearchResult {
        const base = `${input.term}|${input.marketplace}|${input.language}`;
        const interestScore = scoreFromHash(hashString(`${base}|interest`));
        const competitionScore = scoreFromHash(hashString(`${base}|competition`));
        const relatedKeywords = this.buildRelatedKeywords(input.term);
        const summary = `Demand for "${input.term}" shows an interest score of ${interestScore}/100 with competition at ${competitionScore}/100. Best aligned for ${input.marketplace} shoppers searching in ${input.language}.`;

        return {
            summary,
            interestScore,
            competitionScore,
            relatedKeywords,
        };
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
