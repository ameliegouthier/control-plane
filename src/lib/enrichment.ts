/**
 * AI enrichment layer (mock — Week 2).
 *
 * Deterministic keyword heuristics that mimic what a real LLM enrichment
 * would produce.  To swap in real AI: replace getEnrichmentForWorkflow()
 * internals only — the signature and types stay the same.
 *
 * Week 6: issues + severity + copy via action-engine (rule-based).
 */

import type { WorkflowIssue } from "@/lib/action-engine/issueEngine";
import {
  enrichIssues,
  getWorkflowSeverity,
  getWorkflowBuckets,
  getWorkflowBucket,
  summarizeWorkflowActions,
} from "@/lib/action-engine/issueEngine";
import type {
  EnrichedIssue,
  IssueCategory,
} from "@/lib/action-engine/issueEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawWorkflow {
  id: string;
  name: string;
  active: boolean;
  triggerType?: string;
  nodesCount?: number;
  hasPublicWebhook?: boolean;
  nodes?: unknown[];
  /** Last execution status from n8n API (or mock). */
  lastExecutionStatus?: "success" | "error" | null;
  /** ISO date of last execution. null = never ran. */
  lastExecutionDate?: string | null;
  /** Canonical destination for grouping (e.g. HubSpot, Slack). When set, used as output. */
  destination?: string;
  /** Override health for demo/display (e.g. optimizable). */
  healthOverride?: HealthStatus;
}

export type WorkflowDomain =
  | "Operations"
  | "Sales"
  | "Marketing/Growth"
  | "Support/CS"
  | "Finance"
  | "Product/Engineering"
  | "Data/Analytics"
  | "HR"
  | "Unknown";

export type RiskFlag =
  | "public_webhook"
  | "no_trigger"
  | "inactive"
  | "high_complexity"
  | "unknown";

export type HealthStatus = "ok" | "warning" | "broken" | "optimizable";

export interface WorkflowEnrichment {
  domain: WorkflowDomain;
  output: string;
  systems: string[];
  riskFlags: RiskFlag[];
  health: HealthStatus;
  confidence: number;
  reason: string;
}

export type WorkflowWithEnrichment = RawWorkflow & {
  enrichment: WorkflowEnrichment;
};

/** Extended enrichment with issues + severity + category (broken/security/optimization). */
export type WorkflowWithFullEnrichment = WorkflowWithEnrichment & {
  /** Raw issues from detection (unchanged for backward compatibility). */
  issues: WorkflowIssue[];
  /** Issues with category, severity + copy (rule-based). */
  issuesEnriched: EnrichedIssue[];
  /** Max issue severity 0–100. */
  severity: number;
  /** Workflow-level primary category: broken, security, optimization, or null if no issues. */
  category: IssueCategory | null;
  /** At least one broken issue. */
  hasBroken: boolean;
  /** At least one security issue. */
  hasSecurity: boolean;
  /** At least one optimization issue. */
  hasOptimization: boolean;
  /** Type of the top-priority issue, if any. */
  topIssueType?: string;
  /** Recommended action for the top issue. */
  topRecommendedAction?: string | null;
};

export interface DuplicatePair {
  idA: string;
  nameA: string;
  idB: string;
  nameB: string;
  reason: "exact_name" | "probable";
}

/** Map from workflow id → names of similar workflows */
export type DuplicateMap = Map<string, string[]>;

// ─── Duplicate detection ─────────────────────────────────────────────────────

function firstWords(name: string, count = 3): string {
  return name.toLowerCase().split(/[\s→\-]+/).filter(Boolean).slice(0, count).join(" ");
}

/**
 * Detect duplicate / redundant workflow pairs.
 * - Exact same name → certain duplicate
 * - Same domain + same output + same first words → probable duplicate
 */
export function detectDuplicates(
  workflows: WorkflowWithEnrichment[],
): { pairs: DuplicatePair[]; map: DuplicateMap } {
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < workflows.length; i++) {
    for (let j = i + 1; j < workflows.length; j++) {
      const a = workflows[i];
      const b = workflows[j];
      const pairKey = [a.id, b.id].sort().join(":");

      if (seen.has(pairKey)) continue;

      const nameA = a.name.trim().toLowerCase();
      const nameB = b.name.trim().toLowerCase();

      if (nameA === nameB) {
        seen.add(pairKey);
        pairs.push({ idA: a.id, nameA: a.name, idB: b.id, nameB: b.name, reason: "exact_name" });
        continue;
      }

      const sameDomain =
        a.enrichment.domain === b.enrichment.domain &&
        a.enrichment.domain !== "Unknown";
      const sameOutput = a.enrichment.output === b.enrichment.output;
      const sameStart = firstWords(a.name) === firstWords(b.name) && firstWords(a.name).length > 0;

      if (sameDomain && sameOutput && sameStart) {
        seen.add(pairKey);
        pairs.push({ idA: a.id, nameA: a.name, idB: b.id, nameB: b.name, reason: "probable" });
      }
    }
  }

  const map: DuplicateMap = new Map();
  for (const p of pairs) {
    map.set(p.idA, [...(map.get(p.idA) ?? []), p.nameB]);
    map.set(p.idB, [...(map.get(p.idB) ?? []), p.nameA]);
  }

  return { pairs, map };
}

// ─── Issue derivation (Action Engine v0) ─────────────────────────────────────

export type {
  WorkflowIssue,
  EnrichedIssue,
  IssueCategory,
} from "@/lib/action-engine/issueEngine";
export { getWorkflowBucket } from "@/lib/action-engine/issueEngine";

/**
 * Derive raw issues for a single workflow from enrichment + optional duplicate list.
 * Provider-agnostic; used by the full enrichment pipeline.
 */
export function getIssuesForWorkflow(
  _raw: RawWorkflow,
  enrichment: WorkflowEnrichment,
  options?: { duplicateOf?: string[] },
): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];

  if (enrichment.health === "broken") {
    issues.push({ type: "broken" });
  }
  if (enrichment.riskFlags.includes("public_webhook")) {
    issues.push({ type: "public_webhook" });
  }
  const duplicateOf = options?.duplicateOf;
  if (duplicateOf?.length) {
    issues.push({
      type: "duplicate",
      metadata: { similarWorkflowNames: duplicateOf },
    });
  }
  const otherFlags = enrichment.riskFlags.filter(
    (f) =>
      f !== "public_webhook" &&
      f !== "inactive" &&
      (f === "no_trigger" || f === "high_complexity" || f === "unknown"),
  );
  if (otherFlags.length > 0 && issues.length === 0) {
    issues.push({ type: "info" });
  }

  return issues;
}

/**
 * Add issues + issuesEnriched + severity + top action to workflows with enrichment.
 * Non-breaking: call after building WorkflowWithEnrichment[]; duplicate map from detectDuplicates.
 */
export function addIssuesToEnrichedWorkflows(
  workflows: WorkflowWithEnrichment[],
  duplicateMap: DuplicateMap,
): WorkflowWithFullEnrichment[] {
  return workflows.map((wf) => {
    const issues = getIssuesForWorkflow(wf, wf.enrichment, {
      duplicateOf: duplicateMap.get(wf.id) ?? undefined,
    });
    const issuesEnriched = enrichIssues(issues);
    const severity = getWorkflowSeverity(issuesEnriched);
    const summary = summarizeWorkflowActions(issuesEnriched);
    const { hasBroken, hasSecurity, hasOptimization } =
      getWorkflowBuckets(issuesEnriched);
    const category = getWorkflowBucket(issuesEnriched);
    if (process.env.NODE_ENV === "development" && issuesEnriched.length > 0) {
      console.log("OPTIMIZATION_DEBUG: issues detected", {
        workflowId: wf.id,
        issues: issuesEnriched,
      });
    }
    return {
      ...wf,
      issues,
      issuesEnriched,
      severity,
      category,
      hasBroken,
      hasSecurity,
      hasOptimization,
      topIssueType: summary.topIssue?.type,
      topRecommendedAction: summary.topRecommendedAction ?? undefined,
    };
  });
}

// ─── Keyword maps ────────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: [WorkflowDomain, string[]][] = [
  ["Finance", ["invoice", "payment", "stripe", "billing", "accounting", "revenue", "payout"]],
  ["Sales", ["hubspot", "deal", "crm", "pipeline", "sales", "prospect"]],
  ["Marketing/Growth", ["campaign", "ads", "email", "marketing", "seo", "blog", "content", "nurture", "newsletter", "magnet", "lead"]],
  ["Support/CS", ["support", "zendesk", "ticket", "helpdesk", "intercom"]],
  ["Product/Engineering", ["deploy", "github", "ci", "build", "release", "linear", "jira", "engineering", "failure"]],
  ["Operations", ["sync", "report", "digest", "notification", "alert", "ops", "monitor", "automation", "weekly", "daily"]],
  ["Data/Analytics", ["analytics", "metric", "dashboard", "warehouse", "etl", "bigquery"]],
  ["HR", ["onboarding", "employee", "hiring", "recruitment", "payroll"]],
];

const SYSTEM_KEYWORDS: [string, string][] = [
  ["slack", "Slack"],
  ["notion", "Notion"],
  ["airtable", "Airtable"],
  ["stripe", "Stripe"],
  ["gmail", "Gmail"],
  ["hubspot", "HubSpot"],
  ["github", "GitHub"],
  ["google sheets", "Google Sheets"],
  ["linear", "Linear"],
  ["openai", "OpenAI"],
  ["wordpress", "WordPress"],
  ["salesforce", "Salesforce"],
  ["jira", "Jira"],
];

// ─── Core enrichment function ────────────────────────────────────────────────

/**
 * Mock enrichment for a single workflow.
 * Replace this function's body with a real LLM call when ready.
 */
export function getEnrichmentForWorkflow(raw: RawWorkflow): WorkflowEnrichment {
  const name = raw.name.toLowerCase();

  const domain = detectDomain(name);
  const systems = detectSystems(name);
  const output = raw.destination ?? deriveOutput(name, systems, domain);
  const riskFlags = deriveRiskFlags(raw, name, domain, systems);
  const health = raw.healthOverride ?? deriveHealth(raw, riskFlags);

  const hasDomain = domain !== "Unknown";
  const hasSystems = systems.length > 0;
  const confidence =
    hasDomain && hasSystems ? 0.85 : hasDomain || hasSystems ? 0.65 : 0.4;

  const reason = deriveReason(raw, domain, systems, health, confidence);

  return { domain, output, systems, riskFlags, health, confidence, reason };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function detectDomain(name: string): WorkflowDomain {
  let best: WorkflowDomain = "Unknown";
  let bestCount = 0;

  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    const count = keywords.filter((kw) => name.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      best = domain;
    }
  }
  return best;
}

function detectSystems(name: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const [keyword, label] of SYSTEM_KEYWORDS) {
    if (name.includes(keyword) && !seen.has(label)) {
      seen.add(label);
      result.push(label);
    }
  }
  return result;
}

function deriveOutput(
  name: string,
  systems: string[],
  domain: WorkflowDomain,
): string {
  if (systems.length >= 2) return `Sync ${systems[0]} data to ${systems[1]}`;

  if (name.includes("report") || name.includes("digest")) {
    return systems.length > 0
      ? `Send periodic report via ${systems[0]}`
      : "Generate and distribute periodic report";
  }
  if (name.includes("alert") || name.includes("notify")) {
    return systems.length > 0
      ? `Send alert notification to ${systems[0]}`
      : "Send automated alert notification";
  }
  if (name.includes("sync")) {
    return systems.length > 0
      ? `Sync data with ${systems[0]}`
      : `Sync ${domain.toLowerCase()} data`;
  }
  if (systems.length === 1) return `${domain} automation via ${systems[0]}`;

  return domain !== "Unknown"
    ? `Automated ${domain.toLowerCase()} workflow`
    : "Unconfigured workflow";
}

function deriveRiskFlags(
  raw: RawWorkflow,
  name: string,
  domain: WorkflowDomain,
  systems: string[],
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (!raw.active) flags.push("inactive");

  if (raw.hasPublicWebhook || name.includes("webhook")) {
    flags.push("public_webhook");
  }

  if (
    raw.triggerType !== undefined &&
    (!raw.triggerType || raw.triggerType === "none")
  ) {
    flags.push("no_trigger");
  }

  const nodeCount = raw.nodes?.length ?? raw.nodesCount ?? 0;
  if (nodeCount > 10) flags.push("high_complexity");

  if (domain === "Unknown" && systems.length === 0) flags.push("unknown");

  return flags;
}

const STALE_THRESHOLD_DAYS = 30;

function deriveHealth(raw: RawWorkflow, riskFlags: RiskFlag[]): HealthStatus {
  // Primary signal: last execution status from n8n
  if (raw.lastExecutionStatus === "error") return "broken";

  // Stale: no execution in 30+ days
  if (raw.lastExecutionDate) {
    const daysSince =
      (Date.now() - new Date(raw.lastExecutionDate).getTime()) / 86_400_000;
    if (daysSince > STALE_THRESHOLD_DAYS) return "warning";
  }

  // Inactive workflow that never ran
  if (!raw.active && !raw.lastExecutionDate) return "warning";

  // Fallback: risk flags (public webhook, no trigger, etc.)
  const significant = riskFlags.filter((f) => f !== "inactive");
  if (significant.length > 0) return "warning";

  return "ok";
}

function deriveReason(
  raw: RawWorkflow,
  domain: WorkflowDomain,
  systems: string[],
  health: HealthStatus,
  confidence: number,
): string {
  // Execution-based reasons take priority
  if (health === "broken" && raw.lastExecutionStatus === "error")
    return "Last execution failed";

  if (health === "warning") {
    if (raw.lastExecutionDate) {
      const daysSince =
        (Date.now() - new Date(raw.lastExecutionDate).getTime()) / 86_400_000;
      if (daysSince > STALE_THRESHOLD_DAYS)
        return `No execution in ${Math.round(daysSince)} days`;
    }
    if (!raw.active && !raw.lastExecutionDate)
      return "Workflow inactive, never executed";
  }

  // Fallback to classification-based reasons
  if (confidence >= 0.85)
    return `Detected ${domain} workflow using ${systems.join(", ")}`;
  if (confidence >= 0.65 && domain !== "Unknown")
    return `Detected ${domain} workflow (limited system info)`;
  if (confidence >= 0.65) return `Detected systems: ${systems.join(", ")}`;
  return "Insufficient data for classification";
}
