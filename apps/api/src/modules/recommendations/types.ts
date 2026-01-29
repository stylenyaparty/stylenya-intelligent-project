import type { Seasonality } from "@prisma/client";

export type WeeklyFocusAction =
    | "MIGRATE"
    | "BOOST"
    | "RETIRE"
    | "PAUSE"
    | "KEEP";

export type WeeklyFocusSignals = {
    inShopify: boolean;
    d90Units: number;
    d180Units: number;
    requests30d: number;
    seasonality: Seasonality;
};

export type WeeklyFocusItem = {
    productId: string;
    name: string;
    action: WeeklyFocusAction;
    priorityScore: number;
    why: string;
    signals: WeeklyFocusSignals;
};

export type EngineSettings = {
    boostSalesThresholdD90: number;
    retireSalesThresholdD180: number;
    requestThemePriorityThreshold: number;
};
