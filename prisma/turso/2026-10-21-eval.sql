-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiteId" TEXT NOT NULL,
    "suiteVersion" TEXT NOT NULL,
    "suiteHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "requiredPassed" INTEGER NOT NULL,
    "requiredTotal" INTEGER NOT NULL,
    "safetyViolations" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvalPromotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiteId" TEXT NOT NULL,
    "candidateRunId" TEXT NOT NULL,
    "baselineRunId" TEXT,
    "status" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reasonsJson" TEXT NOT NULL,
    "previousChampionRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "EvalRun_suiteId_createdAt_idx" ON "EvalRun"("suiteId", "createdAt");

-- CreateIndex
CREATE INDEX "EvalRun_fingerprint_idx" ON "EvalRun"("fingerprint");

-- CreateIndex
CREATE INDEX "EvalPromotion_suiteId_status_decidedAt_idx" ON "EvalPromotion"("suiteId", "status", "decidedAt");
