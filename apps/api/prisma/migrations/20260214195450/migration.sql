/*
  Warnings:

  - The values [BOTH] on the enum `ProductSource` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProductSource_new" AS ENUM ('ETSY', 'SHOPIFY', 'MANUAL');
ALTER TABLE "Product" ALTER COLUMN "productSource" TYPE "ProductSource_new" USING ("productSource"::text::"ProductSource_new");
ALTER TYPE "ProductSource" RENAME TO "ProductSource_old";
ALTER TYPE "ProductSource_new" RENAME TO "ProductSource";
DROP TYPE "public"."ProductSource_old";
COMMIT;
