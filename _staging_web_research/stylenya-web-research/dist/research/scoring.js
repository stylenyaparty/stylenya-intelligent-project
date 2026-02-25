export function clamp(n, min = 0, max = 1) {
    return Math.max(min, Math.min(max, n));
}
export function normalizeMentions(mentions, cap = 6) {
    const m = Number.isFinite(mentions) ? mentions : 0;
    return clamp(Math.min(Math.max(m, 0), cap) / cap, 0, 1);
}
export function computeResearchScore(input) {
    const mentionsNorm = normalizeMentions(input.mentions, 6);
    const recency = clamp(input.recencyScore ?? 0.5, 0, 1);
    const domains = Math.max(1, input.domainsCount ?? 1);
    const sources = Math.max(1, input.sourcesCount ?? 1);
    // diversidad 0..1 (suave)
    const diversity = clamp(domains / Math.max(3, sources), 0, 1);
    const score = 0.10 +
        0.60 * mentionsNorm +
        0.25 * recency +
        0.05 * diversity;
    return clamp(score, 0, 1);
}
export function scoreAndSortRows(rows) {
    const scored = rows.map((r) => ({
        ...r,
        researchScore: computeResearchScore({
            mentions: r.mentions ?? 0,
            recencyScore: r.recencyScore ?? 0.5,
            sourcesCount: r.sourcesCount ?? 1,
            domainsCount: r.domainsCount ?? 1,
        }),
    }));
    scored.sort((a, b) => {
        if ((b.researchScore ?? 0) !== (a.researchScore ?? 0)) {
            return (b.researchScore ?? 0) - (a.researchScore ?? 0);
        }
        return (b.mentions ?? 0) - (a.mentions ?? 0);
    });
    return scored;
}
//# sourceMappingURL=scoring.js.map