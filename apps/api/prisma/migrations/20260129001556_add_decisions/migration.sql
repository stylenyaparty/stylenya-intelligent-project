/*
  Warnings:

  - You are about to drop the column `llmSummary` on the `Decision` table. All the data in the column will be lost.
  - You are about to drop the column `llmUsed` on the `Decision` table. All the data in the column will be lost.
  - You are about to drop the column `targetType` on the `Decision` table. All the data in the column will be lost.
  - You are about to drop the column `theme` on the `Decision` table. All the data in the column will be lost.
  - Made the column `productId` on table `Decision` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Decision" DROP CONSTRAINT "Decision_productId_fkey";

-- AlterTable
ALTER TABLE "Decision" DROP COLUMN "llmSummary",
DROP COLUMN "llmUsed",
DROP COLUMN "targetType",
DROP COLUMN "theme",
ALTER COLUMN "productId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
