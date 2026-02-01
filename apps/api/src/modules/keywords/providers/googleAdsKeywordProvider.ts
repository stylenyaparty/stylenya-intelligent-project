import type {
    KeywordResearchProvider,
    KeywordResearchSeedInput,
    KeywordSuggestion,
} from "./providerTypes.js";
import { AppError } from "../../../types/app-error.js";

export type GoogleAdsProviderConfig = {
    customerId: string;
    developerToken: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
};

export class GoogleAdsKeywordProvider implements KeywordResearchProvider {
    private readonly config: GoogleAdsProviderConfig;

    constructor(config: GoogleAdsProviderConfig) {
        this.config = config;
    }

    async getSuggestions(_input: KeywordResearchSeedInput): Promise<KeywordSuggestion[]> {
        void this.config;
        throw new AppError(
            503,
            "PROVIDER_UNAVAILABLE",
            "Google Ads keyword provider is not yet available.",
            { provider: "GOOGLE_ADS" }
        );
    }
}
