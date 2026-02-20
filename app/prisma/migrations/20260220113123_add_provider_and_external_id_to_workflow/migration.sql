-- AlterTable: Add provider and externalId columns (nullable initially)
ALTER TABLE "Workflow" ADD COLUMN "provider" TEXT;
ALTER TABLE "Workflow" ADD COLUMN "externalId" TEXT;

-- AlterTable: Make toolWorkflowId nullable for backward compatibility
ALTER TABLE "Workflow" ALTER COLUMN "toolWorkflowId" DROP NOT NULL;

-- Populate provider and externalId from existing data
-- Derive provider from Connection.tool and use toolWorkflowId as externalId
UPDATE "Workflow" w
SET 
  "provider" = CASE 
    WHEN c."tool" = 'N8N' THEN 'n8n'
    WHEN c."tool" = 'MAKE' THEN 'make'
    WHEN c."tool" = 'ZAPIER' THEN 'zapier'
    ELSE 'n8n' -- Default fallback
  END,
  "externalId" = w."toolWorkflowId"
FROM "Connection" c
WHERE w."connectionId" = c."id"
  AND (w."provider" IS NULL OR w."externalId" IS NULL);

-- Make provider and externalId non-nullable
ALTER TABLE "Workflow" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "Workflow" ALTER COLUMN "externalId" SET NOT NULL;

-- CreateIndex: Add index on provider for faster queries
CREATE INDEX "Workflow_provider_idx" ON "Workflow"("provider");

-- CreateIndex: Add unique constraint on (provider, externalId)
CREATE UNIQUE INDEX "Workflow_provider_externalId_key" ON "Workflow"("provider", "externalId");
