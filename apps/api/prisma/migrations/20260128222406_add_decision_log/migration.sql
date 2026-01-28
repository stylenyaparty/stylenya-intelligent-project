-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT 'v1',
    "itemsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionLog_weekStart_idx" ON "DecisionLog"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionLog_weekStart_engineVersion_key" ON "DecisionLog"("weekStart", "engineVersion");
