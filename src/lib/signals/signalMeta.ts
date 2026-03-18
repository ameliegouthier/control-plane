import type { SignalType } from "./types";

export type SignalLevel = "security" | "alert" | "workflow_optim" | "system_optim";

export interface SignalMeta {
  label: string;
  level: SignalLevel;
  recommendedAction: string;
}

export const SIGNAL_META: Record<SignalType, SignalMeta> = {
  // Security
  public_webhook: {
    label: "Public Webhook",
    level: "security",
    recommendedAction: "Add authentication to the webhook endpoint to restrict access.",
  },
  missing_auth: {
    label: "Missing Authentication",
    level: "security",
    recommendedAction: "Configure credentials or API keys for all external service connections.",
  },
  external_webhook: {
    label: "External Webhook",
    level: "security",
    recommendedAction: "Verify the external webhook source is trusted and add request validation.",
  },
  // Alerts
  broken_workflow: {
    label: "Broken Workflow",
    level: "alert",
    recommendedAction: "Inspect the error log and fix the failing node or trigger.",
  },
  missing_credentials: {
    label: "Missing Credentials",
    level: "alert",
    recommendedAction: "Re-authenticate the affected service connections.",
  },
  failed_last_run: {
    label: "Failed Last Run",
    level: "alert",
    recommendedAction: "Review the last execution error and address the root cause.",
  },
  no_trigger: {
    label: "No Trigger",
    level: "alert",
    recommendedAction: "Add a trigger node so the workflow starts automatically.",
  },
  // Workflow optimizations
  fan_out_workflow: {
    label: "Fan-out Workflow",
    level: "workflow_optim",
    recommendedAction: "Consider splitting into smaller focused workflows or use sub-workflows.",
  },
  over_complex_workflow: {
    label: "Over-complex Workflow",
    level: "workflow_optim",
    recommendedAction: "Break this workflow into smaller, focused sub-workflows.",
  },
  duplicate_action: {
    label: "Duplicate Action",
    level: "workflow_optim",
    recommendedAction: "Remove or merge repeated actions within this workflow.",
  },
  inefficient_chain: {
    label: "Inefficient Chain",
    level: "workflow_optim",
    recommendedAction: "Optimize the sequence by removing unnecessary intermediate steps.",
  },
  // System optimizations
  duplicate_workflow: {
    label: "Duplicate Workflow",
    level: "system_optim",
    recommendedAction: "Consolidate duplicate workflows into a single reusable workflow.",
  },
  orphan_service: {
    label: "Orphan Service",
    level: "system_optim",
    recommendedAction: "Remove or reconnect unused service integrations.",
  },
  too_many_integrations: {
    label: "Too Many Integrations",
    level: "system_optim",
    recommendedAction: "Consolidate integrations to reduce complexity and maintenance overhead.",
  },
};

export const URGENT_LEVELS = new Set<SignalLevel>(["security", "alert"]);
export const OPTIM_LEVELS = new Set<SignalLevel>(["workflow_optim", "system_optim"]);
