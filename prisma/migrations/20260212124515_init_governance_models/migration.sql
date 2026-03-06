-- CreateEnum
CREATE TYPE "ToolType" AS ENUM ('N8N', 'ZAPIER', 'MAKE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" "ToolType" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalAccountId" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "toolWorkflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggerType" TEXT,
    "triggerConfig" JSONB,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "workflowsCount" INTEGER,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Connection_userId_idx" ON "Connection"("userId");

-- CreateIndex
CREATE INDEX "Connection_tool_idx" ON "Connection"("tool");

-- CreateIndex
CREATE INDEX "Connection_status_idx" ON "Connection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_userId_tool_key" ON "Connection"("userId", "tool");

-- CreateIndex
CREATE INDEX "Workflow_userId_idx" ON "Workflow"("userId");

-- CreateIndex
CREATE INDEX "Workflow_connectionId_idx" ON "Workflow"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_connectionId_toolWorkflowId_key" ON "Workflow"("connectionId", "toolWorkflowId");

-- CreateIndex
CREATE INDEX "SyncLog_userId_idx" ON "SyncLog"("userId");

-- CreateIndex
CREATE INDEX "SyncLog_connectionId_idx" ON "SyncLog"("connectionId");

-- CreateIndex
CREATE INDEX "SyncLog_syncedAt_idx" ON "SyncLog"("syncedAt");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
