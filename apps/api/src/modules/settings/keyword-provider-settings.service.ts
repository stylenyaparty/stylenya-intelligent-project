import type { Settings } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { AppError } from "../../types/app-error.js";

const DEFAULT_SETTINGS: Omit<Settings, "updatedAt"> = {
    id: 1,
    boostSalesThresholdD90: 10,
    retireSalesThresholdD180: 2,
    requestThemePriorityThreshold: 3,
    defaultCurrency: "USD",
    googleAdsEnabled: false,
    googleAdsCustomerId: null,
    googleAdsDeveloperToken: null,
    googleAdsClientId: null,
    googleAdsClientSecret: null,
    googleAdsRefreshToken: null,
};

export type GoogleAdsStatus = {
    enabled: boolean;
    configured: boolean;
    customerId?: string;
};

export type GoogleAdsCredentials = {
    customerId: string;
    developerToken: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
};

type GoogleAdsSettingsInput = {
    enabled: boolean;
    customerId?: string;
    developerToken?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
};

function isNonEmpty(value?: string | null): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isGoogleAdsConfigured(settings: Settings) {
    return (
        isNonEmpty(settings.googleAdsCustomerId) &&
        isNonEmpty(settings.googleAdsDeveloperToken) &&
        isNonEmpty(settings.googleAdsClientId) &&
        isNonEmpty(settings.googleAdsClientSecret) &&
        isNonEmpty(settings.googleAdsRefreshToken)
    );
}

async function getOrCreateSettings() {
    return prisma.settings.upsert({
        where: { id: 1 },
        update: {},
        create: DEFAULT_SETTINGS,
    });
}

export async function getGoogleAdsStatus(): Promise<GoogleAdsStatus> {
    const settings = await getOrCreateSettings();
    return {
        enabled: settings.googleAdsEnabled,
        configured: isGoogleAdsConfigured(settings),
        customerId: settings.googleAdsCustomerId ?? undefined,
    };
}

export async function getGoogleAdsCredentials(): Promise<GoogleAdsCredentials | null> {
    const settings = await getOrCreateSettings();
    if (!settings.googleAdsEnabled || !isGoogleAdsConfigured(settings)) {
        return null;
    }
    return {
        customerId: settings.googleAdsCustomerId!.trim(),
        developerToken: settings.googleAdsDeveloperToken!.trim(),
        clientId: settings.googleAdsClientId!.trim(),
        clientSecret: settings.googleAdsClientSecret!.trim(),
        refreshToken: settings.googleAdsRefreshToken!.trim(),
    };
}

export async function updateGoogleAdsSettings(input: GoogleAdsSettingsInput) {
    const trimmed = {
        customerId: input.customerId?.trim(),
        developerToken: input.developerToken?.trim(),
        clientId: input.clientId?.trim(),
        clientSecret: input.clientSecret?.trim(),
        refreshToken: input.refreshToken?.trim(),
    };

    if (input.enabled) {
        const missing = Object.entries(trimmed)
            .filter(([, value]) => !isNonEmpty(value))
            .map(([key]) => key);
        if (missing.length > 0) {
            throw new AppError(
                400,
                "GOOGLE_ADS_INCOMPLETE_CONFIG",
                "Google Ads configuration is incomplete.",
                { missing }
            );
        }
    }

    await getOrCreateSettings();

    const updated = await prisma.settings.update({
        where: { id: 1 },
        data: {
            googleAdsEnabled: input.enabled,
            googleAdsCustomerId: trimmed.customerId ?? null,
            googleAdsDeveloperToken: trimmed.developerToken ?? null,
            googleAdsClientId: trimmed.clientId ?? null,
            googleAdsClientSecret: trimmed.clientSecret ?? null,
            googleAdsRefreshToken: trimmed.refreshToken ?? null,
        },
    });

    return {
        enabled: updated.googleAdsEnabled,
        configured: isGoogleAdsConfigured(updated),
        customerId: updated.googleAdsCustomerId ?? undefined,
    };
}
