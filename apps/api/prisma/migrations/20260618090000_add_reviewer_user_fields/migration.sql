-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isReviewer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");
