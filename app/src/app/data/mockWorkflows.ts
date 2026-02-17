/**
 * Mock workflow data for the Overview page (Week 2 — offline mode).
 *
 * Simplified model: no nodes/connections blobs, just the fields
 * the overview needs for stats, signals, and the table.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OverviewWorkflow {
  id: string;
  name: string;
  active: boolean;
  triggerType: "webhook" | "cron" | "manual" | "none" | string;
  nodesCount: number;
  hasPublicWebhook?: boolean;
  lastExecutionStatus?: "success" | "error" | null;
  lastExecutionDate?: string | null;
}

export interface OverviewStats {
  total: number;
  active: number;
  inactive: number;
  withSignals: number;
}

export interface WorkflowSignals {
  publicWebhook: boolean;
  noTrigger: boolean;
  inactive: boolean;
}

export interface SignalCounters {
  publicWebhooks: number;
  noTrigger: number;
  inactive: number;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

export const MOCK_WORKFLOWS: OverviewWorkflow[] = [
  {
    id: "101",
    name: "Lead Magnet → Email Nurture → HubSpot Sync",
    active: true,
    triggerType: "webhook",
    nodesCount: 5,
    hasPublicWebhook: true,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-16T10:30:00Z",
  },
  {
    id: "102",
    name: "Stripe Payment → Notion CRM → Slack Alert",
    active: true,
    triggerType: "webhook",
    nodesCount: 4,
    hasPublicWebhook: false,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-17T08:15:00Z",
  },
  {
    id: "103",
    name: "GitHub CI Failure → Linear Issue Creation",
    active: false,
    triggerType: "webhook",
    nodesCount: 4,
    hasPublicWebhook: false,
    lastExecutionStatus: "success",
    lastExecutionDate: "2025-12-01T14:00:00Z", // > 30 days → stale warning
  },
  {
    id: "104",
    name: "AI Blog Generator → SEO → Publish",
    active: true,
    triggerType: "webhook",
    nodesCount: 5,
    hasPublicWebhook: true,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-15T22:00:00Z",
  },
  {
    id: "201",
    name: "Weekly Marketing Report → Slack Digest",
    active: true,
    triggerType: "cron",
    nodesCount: 4,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-14T09:00:00Z",
  },
  {
    id: "202",
    name: "Weekly Marketing Report → Slack Digest (Copy)",
    active: true,
    triggerType: "cron",
    nodesCount: 4,
    lastExecutionStatus: "success",
    lastExecutionDate: "2026-02-14T09:00:00Z",
  },
  {
    id: "999",
    name: "CRM Sync — HubSpot to Airtable",
    active: true,
    triggerType: "webhook",
    nodesCount: 3,
    hasPublicWebhook: true,
    lastExecutionStatus: "error",             // Last run failed → Broken
    lastExecutionDate: "2026-02-17T06:45:00Z",
  },
  {
    id: "300",
    name: "Empty placeholder workflow",
    active: false,
    triggerType: "none",
    nodesCount: 0,
    lastExecutionStatus: null,                // Never ran
    lastExecutionDate: null,                  // → Inactive warning
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute signal flags for a single workflow */
export function getWorkflowSignals(wf: OverviewWorkflow): WorkflowSignals {
  return {
    publicWebhook: wf.hasPublicWebhook === true,
    noTrigger: !wf.triggerType || wf.triggerType === "none",
    inactive: !wf.active,
  };
}

/** Aggregate stats across all workflows */
export function computeStats(workflows: OverviewWorkflow[]): OverviewStats {
  const active = workflows.filter((w) => w.active).length;
  const withSignals = workflows.filter((w) => {
    const s = getWorkflowSignals(w);
    return s.publicWebhook || s.noTrigger || s.inactive;
  }).length;

  return {
    total: workflows.length,
    active,
    inactive: workflows.length - active,
    withSignals,
  };
}

/** Count each signal type across all workflows */
export function computeSignalCounters(
  workflows: OverviewWorkflow[],
): SignalCounters {
  let publicWebhooks = 0;
  let noTrigger = 0;
  let inactive = 0;

  for (const wf of workflows) {
    const s = getWorkflowSignals(wf);
    if (s.publicWebhook) publicWebhooks++;
    if (s.noTrigger) noTrigger++;
    if (s.inactive) inactive++;
  }

  return { publicWebhooks, noTrigger, inactive };
}
