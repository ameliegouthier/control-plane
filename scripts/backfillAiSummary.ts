#!/usr/bin/env tsx
/**
 * Backfill aiSummary for all workflows where the field is null.
 * Usage: npx ts-node scripts/backfillAiSummary.ts
 *        (or: npx tsx scripts/backfillAiSummary.ts)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { prisma } from "../src/lib/prisma";
import { generateWorkflowSummary, generateNodeSummary } from "../src/lib/generateWorkflowSummary";

async function main() {
  const workflows = await prisma.workflow.findMany({
    where: { aiSummary: null },
    include: { workflowNodes: true },
  });

  console.log(`Found ${workflows.length} workflow(s) without aiSummary.`);

  let success = 0;
  let failed = 0;

  for (const workflow of workflows) {
    try {
      const actionNode = workflow.workflowNodes.find((n) => {
        const t = n.type.toLowerCase();
        return !t.includes("trigger") && !t.includes("webhook") && !t.includes("cron");
      });
      const resourceName = actionNode?.name ?? workflow.name;

      const summary = await generateWorkflowSummary(workflow, resourceName);

      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { aiSummary: summary },
      });

      console.log(`✓ [${workflow.id}] "${workflow.name}" → "${summary}"`);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ [${workflow.id}] "${workflow.name}" — error: ${message}`);
      failed++;
    }
  }

  console.log(`\nWorkflows — done. ${success} updated, ${failed} failed.`);

  // ── Nodes backfill ────────────────────────────────────────────────────────
  const nodes = await prisma.workflowNode.findMany({
    where: { aiSummary: null },
    include: { workflow: true },
  });

  console.log(`\nFound ${nodes.length} node(s) without aiSummary.`);

  let nodeSuccess = 0;
  let nodeFailed = 0;

  for (const node of nodes) {
    try {
      const summary = await generateNodeSummary(node, node.workflow.name);

      await prisma.workflowNode.update({
        where: { id: node.id },
        data: { aiSummary: summary },
      });

      console.log(`✓ [${node.id}] "${node.name ?? node.type}" (${node.workflow.name}) → "${summary}"`);
      nodeSuccess++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ [${node.id}] "${node.name ?? node.type}" — error: ${message}`);
      nodeFailed++;
    }
  }

  console.log(`\nNodes — done. ${nodeSuccess} updated, ${nodeFailed} failed.`);
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
