-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "did" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "guardianTier" TEXT NOT NULL DEFAULT 'Seedling',
    "guildId" TEXT,
    "parentId" TEXT,
    "reputation" REAL NOT NULL DEFAULT 50.0,
    "publicKeyMultibase" TEXT,
    "publicKeyHex" TEXT,
    "privateKeyHex" TEXT,
    "keyId" TEXT,
    "authPublicKeyHex" TEXT,
    "authKeyIssuedAt" DATETIME,
    "authKeyRevokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Agent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SoulVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "personality" TEXT NOT NULL,
    "values" TEXT NOT NULL,
    "charter" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoulVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "provenance" TEXT NOT NULL DEFAULT 'self',
    "ttl" TEXT NOT NULL DEFAULT 'permanent',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" DATETIME,
    CONSTRAINT "Memory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 100.0,
    "currency" TEXT NOT NULL DEFAULT 'HELLO',
    "spentToday" REAL NOT NULL DEFAULT 0.0,
    "spentOn" TEXT NOT NULL DEFAULT '',
    "dailyCap" REAL NOT NULL DEFAULT 50.0,
    "circuitOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "traceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperatorControl" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "approvalThreshold" REAL NOT NULL DEFAULT 25.0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActionApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Debate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "quorumWeight" REAL NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'open',
    "forWeight" REAL NOT NULL DEFAULT 0,
    "againstWeight" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DebateArgument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebateArgument_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "Debate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DebateVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebateVote_debateId_fkey" FOREIGN KEY ("debateId") REFERENCES "Debate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0.0,
    "rating" REAL NOT NULL DEFAULT 0.0,
    "installs" INTEGER NOT NULL DEFAULT 0,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "genomeScore" REAL NOT NULL DEFAULT 0.0,
    "manifestHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Skill_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillInstallation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "graftedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillInstallation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillInstallation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Apprenticeship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mentorId" TEXT NOT NULL,
    "apprenticeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'shadowing',
    "procedure" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graduatedAt" DATETIME,
    CONSTRAINT "Apprenticeship_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Apprenticeship_apprenticeId_fkey" FOREIGN KEY ("apprenticeId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurriculumProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "skillTreeId" TEXT NOT NULL,
    "nodeLabel" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "lastAttempt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurriculumProgress_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvolutionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "populationSize" INTEGER NOT NULL,
    "mutationRate" REAL NOT NULL,
    "generationLimit" INTEGER NOT NULL,
    "currentGeneration" INTEGER NOT NULL DEFAULT 0,
    "bestFitness" REAL NOT NULL DEFAULT 0,
    "seed" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EvolutionGeneration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "bestFitness" REAL NOT NULL,
    "averageFitness" REAL NOT NULL,
    "mutationCount" INTEGER NOT NULL,
    "populationJson" TEXT NOT NULL,
    "championJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvolutionGeneration_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvolutionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "charter" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guildId" TEXT,
    "posterId" TEXT NOT NULL,
    "reward" REAL NOT NULL DEFAULT 0.0,
    "eta" TEXT NOT NULL DEFAULT '72h',
    "status" TEXT NOT NULL DEFAULT 'open',
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mission_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mission_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "claimerId" TEXT NOT NULL,
    "bidPrice" REAL NOT NULL,
    "bidEta" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionClaim_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionClaim_claimerId_fkey" FOREIGN KEY ("claimerId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HumanObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "observerName" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "funded" REAL NOT NULL DEFAULT 0.0,
    "intentMessage" TEXT,
    "signature" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "nonce" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HumanObservation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernanceProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'voting',
    "voteType" TEXT NOT NULL DEFAULT 'constitutional',
    "forVotes" INTEGER NOT NULL DEFAULT 0,
    "againstVotes" INTEGER NOT NULL DEFAULT 0,
    "forWeight" REAL NOT NULL DEFAULT 0.0,
    "againstWeight" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GovernanceVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposalId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "support" BOOLEAN NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "quadraticWeight" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GovernanceVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "GovernanceProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GovernanceVote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "cost" REAL NOT NULL DEFAULT 0.0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "subAgents" INTEGER NOT NULL DEFAULT 0,
    "goldenSet" BOOLEAN NOT NULL DEFAULT false,
    "driftScore" REAL NOT NULL DEFAULT 0.0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "Trace_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "A2AMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'MCP+A2A',
    "intent" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "truthTier" TEXT NOT NULL DEFAULT 'asserted',
    "signed" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT,
    "intentHash" TEXT,
    "traceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "A2AMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "A2AMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "A2ATask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "messageJson" TEXT NOT NULL,
    "resultJson" TEXT,
    "traceId" TEXT NOT NULL,
    "intentHash" TEXT,
    "signature" TEXT,
    "budgetCap" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "A2ATask_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "A2ATask_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "note" TEXT,
    "intentMessage" TEXT,
    "signature" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attestation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attestation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoldenSetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelPin" TEXT NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "expectedHash" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GoldenSetReplay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "actualOutput" TEXT NOT NULL,
    "actualHash" TEXT NOT NULL,
    "hashMatch" BOOLEAN NOT NULL,
    "semanticSim" REAL NOT NULL,
    "drift" REAL NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoldenSetReplay_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GoldenSetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeSymbol" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoId" TEXT NOT NULL DEFAULT 'logistics',
    "filePath" TEXT NOT NULL,
    "symbolName" TEXT NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "astNodeId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "returnType" TEXT,
    "sourceText" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "hasDiagnostics" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "symbolName" TEXT,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'error',
    "line" INTEGER NOT NULL,
    "column" INTEGER NOT NULL DEFAULT 0,
    "expectedType" TEXT,
    "receivedType" TEXT,
    "suggestedFix" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CodeMutation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoId" TEXT NOT NULL,
    "agentDid" TEXT NOT NULL,
    "astNodeId" TEXT NOT NULL,
    "symbolName" TEXT NOT NULL,
    "oldSource" TEXT NOT NULL,
    "newSource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "diagnosticJson" TEXT,
    "receiptHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "json" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "resumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FailureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 1,
    "deadEnd" BOOLEAN NOT NULL DEFAULT true,
    "resolution" TEXT NOT NULL DEFAULT '',
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentDid" TEXT NOT NULL,
    "dbSnapshotRef" TEXT NOT NULL,
    "fsSnapshotRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "receiptHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CacheEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "prompt" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CacheLookup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "hit" BOOLEAN NOT NULL,
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "allowedRoles" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CortexMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "agentDid" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "errorSignature" TEXT,
    "deadEndCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContractLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "proposerDid" TEXT NOT NULL,
    "participants" TEXT NOT NULL,
    "schemaJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "challengeNote" TEXT,
    "receiptHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME
);

-- CreateTable
CREATE TABLE "McpToolCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentDid" TEXT,
    "toolName" TEXT NOT NULL,
    "argumentsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "receiptHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agentId" TEXT,
    "intervalSec" INTEGER NOT NULL DEFAULT 3600,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" DATETIME,
    "lastOk" BOOLEAN,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "output" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduledJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "creditCap" REAL NOT NULL,
    "task" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "returned" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "author" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "repo" TEXT NOT NULL DEFAULT '',
    "receipt" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RequestNonce" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "principal" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "responseJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);

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
CREATE UNIQUE INDEX "Agent_did_key" ON "Agent"("did");

-- CreateIndex
CREATE UNIQUE INDEX "SoulVersion_agentId_version_key" ON "SoulVersion"("agentId", "version");

-- CreateIndex
CREATE INDEX "Memory_agentId_tier_idx" ON "Memory"("agentId", "tier");

-- CreateIndex
CREATE INDEX "Memory_agentId_validFrom_validTo_idx" ON "Memory"("agentId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_agentId_key" ON "Wallet"("agentId");

-- CreateIndex
CREATE INDEX "ActionApproval_status_idx" ON "ActionApproval"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DebateVote_debateId_agentId_key" ON "DebateVote"("debateId", "agentId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillInstallation_skillId_agentId_key" ON "SkillInstallation"("skillId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumProgress_agentId_skillTreeId_key" ON "CurriculumProgress"("agentId", "skillTreeId");

-- CreateIndex
CREATE INDEX "EvolutionRun_status_updatedAt_idx" ON "EvolutionRun"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "EvolutionGeneration_runId_generation_idx" ON "EvolutionGeneration"("runId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "EvolutionGeneration_runId_generation_key" ON "EvolutionGeneration"("runId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_slug_key" ON "Guild"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceVote_proposalId_agentId_key" ON "GovernanceVote"("proposalId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Trace_traceId_key" ON "Trace"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "A2ATask_taskId_key" ON "A2ATask"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "A2ATask_traceId_key" ON "A2ATask"("traceId");

-- CreateIndex
CREATE INDEX "A2ATask_receiverId_status_idx" ON "A2ATask"("receiverId", "status");

-- CreateIndex
CREATE INDEX "A2ATask_traceId_idx" ON "A2ATask"("traceId");

-- CreateIndex
CREATE INDEX "Attestation_toId_idx" ON "Attestation"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_fromId_toId_claim_key" ON "Attestation"("fromId", "toId", "claim");

-- CreateIndex
CREATE INDEX "GoldenSetReplay_itemId_idx" ON "GoldenSetReplay"("itemId");

-- CreateIndex
CREATE INDEX "CodeSymbol_repoId_filePath_idx" ON "CodeSymbol"("repoId", "filePath");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSymbol_repoId_qualifiedName_key" ON "CodeSymbol"("repoId", "qualifiedName");

-- CreateIndex
CREATE INDEX "Diagnostic_repoId_filePath_idx" ON "Diagnostic"("repoId", "filePath");

-- CreateIndex
CREATE INDEX "AgentSnapshot_agentId_idx" ON "AgentSnapshot"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "FailureRecord_signature_key" ON "FailureRecord"("signature");

-- CreateIndex
CREATE INDEX "CacheEntry_scope_idx" ON "CacheEntry"("scope");

-- CreateIndex
CREATE INDEX "CacheLookup_createdAt_idx" ON "CacheLookup"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRole_agentId_role_key" ON "AgentRole"("agentId", "role");

-- CreateIndex
CREATE INDEX "CortexMemory_task_idx" ON "CortexMemory"("task");

-- CreateIndex
CREATE INDEX "CortexMemory_kind_idx" ON "CortexMemory"("kind");

-- CreateIndex
CREATE INDEX "McpToolCall_toolName_idx" ON "McpToolCall"("toolName");

-- CreateIndex
CREATE INDEX "McpToolCall_createdAt_idx" ON "McpToolCall"("createdAt");

-- CreateIndex
CREATE INDEX "JobRun_jobId_createdAt_idx" ON "JobRun"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delegation_childId_key" ON "Delegation"("childId");

-- CreateIndex
CREATE INDEX "Delegation_parentId_idx" ON "Delegation"("parentId");

-- CreateIndex
CREATE INDEX "DocsPost_clientKey_createdAt_idx" ON "DocsPost"("clientKey", "createdAt");

-- CreateIndex
CREATE INDEX "DocsPost_createdAt_idx" ON "DocsPost"("createdAt");

-- CreateIndex
CREATE INDEX "RequestNonce_createdAt_idx" ON "RequestNonce"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestNonce_principal_nonce_key" ON "RequestNonce"("principal", "nonce");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "IdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_windowStart_key" ON "RateLimitBucket"("key", "windowStart");

-- CreateIndex
CREATE INDEX "EvalRun_suiteId_createdAt_idx" ON "EvalRun"("suiteId", "createdAt");

-- CreateIndex
CREATE INDEX "EvalRun_fingerprint_idx" ON "EvalRun"("fingerprint");

-- CreateIndex
CREATE INDEX "EvalPromotion_suiteId_status_decidedAt_idx" ON "EvalPromotion"("suiteId", "status", "decidedAt");

