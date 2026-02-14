ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "ProductSource" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "shopifyHandle" TEXT,
ADD COLUMN IF NOT EXISTS "importNotes" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_productSource_shopifyHandle_key"
ON "Product"("productSource", "shopifyHandle");

CREATE UNIQUE INDEX IF NOT EXISTS "Product_productSource_etsyListingId_key"
ON "Product"("productSource", "etsyListingId");
