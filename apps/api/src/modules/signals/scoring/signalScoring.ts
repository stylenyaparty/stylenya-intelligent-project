export type SignalScoringInput = {
    avgMonthlySearches: number | null;
    competitionLevel: string | null;
    cpcHigh: number | null;
    change3mPct: number | null;
    changeYoYPct: number | null;
};

const COMPETITION_PENALTY: Record<string, number> = {
    LOW: 0,
    MEDIUM: -1,
    HIGH: -2,
    UNK: -1,
};

export function formatVolume(avgMonthlySearches: number | null) {
    if (avgMonthlySearches === null || avgMonthlySearches === undefined) return "-";
    if (avgMonthlySearches >= 1000) {
        const bucket = Math.round(avgMonthlySearches / 1000);
        return `${bucket}k`;
    }
    return `${Math.round(avgMonthlySearches)}`;
}

export function formatPct(value: number | null) {
    if (value === null || value === undefined) return "-";
    if (value > 0) return "+";
    const pct = Math.round(value * 100);
    return `${pct}%`;
}

export function formatCpc(value: number | null) {
    if (value === null || value === undefined) return "-";
    return `$${value.toFixed(2)}`;
}

function normalizeCompetition(value: string | null) {
    if (!value) return "UNK";
    const normalized = value.toUpperCase();
    if (normalized.startsWith("LOW")) return "LOW";
    if (normalized.startsWith("MED")) return "MEDIUM";
    if (normalized.startsWith("HIGH")) return "HIGH";
    return "UNK";
}

function computeVolumeScore(avgMonthlySearches: number | null) {
    if (avgMonthlySearches === null || avgMonthlySearches === undefined) return 0;
    return Math.log(avgMonthlySearches + 1);
}

function computeCompetitionPenalty(competitionLevel: string | null) {
    const normalized = normalizeCompetition(competitionLevel);
    return COMPETITION_PENALTY[normalized] ?? COMPETITION_PENALTY.UNK;
}

function computeIntentScore(cpcHigh: number | null) {
    if (cpcHigh === null || cpcHigh === undefined) return 0;
    return cpcHigh > 0 ? 1 : 0;
}

function computeTrendScore(change3mPct: number | null, changeYoYPct: number | null) {
    let score = 0;
    if (change3mPct !== null && change3mPct !== undefined) {
        if (change3mPct > 0) score += 0.5;
        if (change3mPct < -0.5) score -= 0.5;
    }
    if (changeYoYPct !== null && changeYoYPct !== undefined) {
        if (changeYoYPct > 0) score += 0.5;
        if (changeYoYPct < -0.5) score -= 0.5;
    }
    return score;
}

export function computeSignalScore(signal: SignalScoringInput) {
    const volumeScore = computeVolumeScore(signal.avgMonthlySearches);
    const competitionPenalty = computeCompetitionPenalty(signal.competitionLevel);
    const intentScore = computeIntentScore(signal.cpcHigh);
    const trendScore = computeTrendScore(signal.change3mPct, signal.changeYoYPct);

    const score = volumeScore + competitionPenalty + intentScore + trendScore;

    const competitionLabel = normalizeCompetition(signal.competitionLevel);
    const reasons = [
        `V:${formatVolume(signal.avgMonthlySearches)}`,
        `C:${competitionLabel}`,
        `CPC:${formatCpc(signal.cpcHigh)}`,
        `3M:${formatPct(signal.change3mPct)}`,
        `YoY:${formatPct(signal.changeYoYPct)}`,
    ].join(" | ");

    return { score, reasons };
}
