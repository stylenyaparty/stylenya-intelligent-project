ALTER TABLE "Settings"
ADD COLUMN "googleAdsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "googleAdsCustomerId" TEXT,
ADD COLUMN "googleAdsDeveloperToken" TEXT,
ADD COLUMN "googleAdsClientId" TEXT,
ADD COLUMN "googleAdsClientSecret" TEXT,
ADD COLUMN "googleAdsRefreshToken" TEXT;
