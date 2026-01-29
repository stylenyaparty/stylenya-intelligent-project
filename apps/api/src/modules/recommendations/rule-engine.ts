import type { EngineSettings, WeeklyFocusItem, WeeklyFocusSignals, WeeklyFocusAction } from "./types";

function baseScore(action: WeeklyFocusAction): number {
    switch (action) {
        case "MIGRATE": return 60;
        case "BOOST": return 45;
        case "RETIRE": return 35;
        case "KEEP": return 15;
        case "PAUSE": return 10;
    }
}

export function evaluateProduct(params: {
    productId: string;
    name: string;
    signals: WeeklyFocusSignals;
    settings: EngineSettings;
}): WeeklyFocusItem {
    const { productId, name, signals, settings } = params;
    const { inShopify, d90Units, d180Units, requests30d, seasonality } = signals;

    let action: WeeklyFocusAction = "KEEP";
    const reasons: string[] = [];

    // MIGRATE
    if (d90Units >= settings.boostSalesThresholdD90 && !inShopify) {
        action = "MIGRATE";
        reasons.push(`Strong Etsy demand (D90=${d90Units}) and not yet in Shopify`);
    }

    // RETIRE
    if (action === "KEEP" && d180Units <= settings.retireSalesThresholdD180 && seasonality === "NONE") {
        action = "RETIRE";
        reasons.push(`Low Etsy performance (D180=${d180Units}) and not seasonal`);
    }

    // BOOST
    if (action === "KEEP" && d90Units >= settings.boostSalesThresholdD90 && inShopify) {
        action = "BOOST";
        reasons.push(`Strong Etsy demand (D90=${d90Units}) and already in Shopify`);
    }

    // PAUSE (heurística MVP)
    if (
        action === "KEEP" &&
        seasonality !== "NONE" &&
        d90Units < Math.max(1, Math.floor(settings.boostSalesThresholdD90 / 2))
    ) {
        action = "PAUSE";
        reasons.push(`Seasonal item with low recent demand (Season=${seasonality}, D90=${d90Units})`);
    }

    // Requests signal
    if (requests30d >= settings.requestThemePriorityThreshold) {
        reasons.push(`High customer intent (requests30d=${requests30d})`);
    }

    const priorityScore =
        baseScore(action) +
        (d90Units * 2) +
        (requests30d * 10) +
        (inShopify ? 0 : 8);

    const why = reasons.length ? reasons.join(". ") + "." : "Stable signals; keep as-is for now.";

    return { productId, name, action, priorityScore, why, signals };
}