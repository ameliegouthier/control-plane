/**
 * Action Engine v0 — Issue severity, bucket (Urgent vs Optimization), and copy.
 * Provider-agnostic; single source of truth for issue priority and messaging.
 *
 * Urgent (Critical): something is broken right now — fix immediately.
 * Optimization (Improve): reduce risk / maintain hygiene — improve when capacity allows.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Urgent = fix now. Optimization = improve when possible. */
export type IssueBucket = "urgent" | "optimization";

/** Extensible union of issue types (aligned with detection). */
export type IssueType =
  | "broken"
  | "conflict"
  | "public_webhook"
  | "duplicate"
  | "inactive"
  | "warning"
  | "info";

/** Severity score 0–100 (higher = more urgent within same bucket). */
export type IssueSeverity = number;

export interface IssueCopy {
  impact: string;
  why: string;
  recommendedAction: string;
}

/** Raw issue as returned by detection (type + optional metadata). */
export interface WorkflowIssue {
  type: IssueType;
  metadata?: Record<string, unknown>;
}

/** Issue with bucket, severity and copy (output of issue engine). */
export type EnrichedIssue = WorkflowIssue & {
  bucket: IssueBucket;
  severity: number;
  copy: IssueCopy;
};

// ─── Rules (single source of truth) ───────────────────────────────────────────

export interface IssueRule {
  bucket: IssueBucket;
  severity: number;
  copy: IssueCopy;
}

/** Single fallback for unknown issue types: optimization, score 30, generic copy. */
export const DEFAULT_RULE: IssueRule = {
  bucket: "optimization",
  severity: 30,
  copy: {
    impact: "This item may need attention.",
    why: "Unknown issue type; review manually.",
    recommendedAction: "Check workflow configuration and logs.",
  },
};

/** Central table: issue type → bucket + severity + copy. */
export const ISSUE_RULES: Record<IssueType, IssueRule> = {
  broken: {
    bucket: "urgent",
    severity: 100,
    copy: {
      impact: "Automation is not running reliably.",
      why: "Failing workflows create silent operational gaps.",
      recommendedAction:
        "Open logs, fix the failing node, re-run a test execution.",
    },
  },
  conflict: {
    bucket: "urgent",
    severity: 90,
    copy: {
      impact: "Two workflows may trigger the same downstream action.",
      why: "Conflicts cause duplicate CRM updates or double notifications.",
      recommendedAction:
        "Clarify ownership and disable/merge the redundant logic.",
    },
  },
  public_webhook: {
    bucket: "optimization",
    severity: 80,
    copy: {
      impact: "Endpoint can be triggered without authentication.",
      why: "Increases security risk and untrusted executions.",
      recommendedAction:
        "Add auth, rotate URL, restrict access, or disable webhook.",
    },
  },
  duplicate: {
    bucket: "optimization",
    severity: 70,
    copy: {
      impact: "Same automation exists multiple times.",
      why: "Harder maintenance and higher risk of inconsistencies.",
      recommendedAction:
        "Keep one source of truth and archive the duplicates.",
    },
  },
  inactive: {
    bucket: "optimization",
    severity: 50,
    copy: {
      impact: "Automation is not currently active.",
      why: "May indicate deprecated processes or forgotten critical ops.",
      recommendedAction:
        "Confirm if still needed, then re-enable or archive.",
    },
  },
  warning: {
    bucket: "optimization",
    severity: 40,
    copy: {
      impact: "Workflow has risk flags or has not run recently.",
      why: "Stale or risky setups can lead to missed automations.",
      recommendedAction:
        "Review last execution, triggers, and re-enable or update if needed.",
    },
  },
  info: {
    bucket: "optimization",
    severity: 20,
    copy: {
      impact: "Informational note only.",
      why: "Low-priority context for operations.",
      recommendedAction:
        "Optional: review when capacity allows.",
    },
  },
};

// ─── Scoring & enrichment ─────────────────────────────────────────────────────

/**
 * Enrich a single raw issue with bucket, severity and copy.
 * Unknown types use DEFAULT_RULE (optimization, score 30, generic copy).
 */
export function enrichIssue(issue: WorkflowIssue): EnrichedIssue {
  const rule = ISSUE_RULES[issue.type as IssueType];
  const { bucket, severity, copy } = rule ?? DEFAULT_RULE;
  return {
    ...issue,
    bucket,
    severity,
    copy,
  };
}

/** Bucket order for stable sort: urgent first (0), then optimization (1). */
const BUCKET_ORDER: Record<IssueBucket, number> = {
  urgent: 0,
  optimization: 1,
};

/**
 * Enrich all issues and sort with stable priority:
 * 1. Bucket (urgent before optimization)
 * 2. Score descending
 * 3. Type ascending (deterministic tie-break)
 */
export function enrichIssues(issues: WorkflowIssue[]): EnrichedIssue[] {
  const enriched = issues.map(enrichIssue);
  return enriched.sort((a, b) => {
    const bucketA = BUCKET_ORDER[a.bucket];
    const bucketB = BUCKET_ORDER[b.bucket];
    if (bucketA !== bucketB) return bucketA - bucketB;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return (a.type ?? "").localeCompare(b.type ?? "", undefined, { sensitivity: "base" });
  });
}

/**
 * Workflow-level severity = max issue severity, or 0 if none.
 */
export function getWorkflowSeverity(issues: EnrichedIssue[]): number {
  if (issues.length === 0) return 0;
  return Math.max(...issues.map((i) => i.severity));
}

/**
 * Next best action summary for a workflow (top issue + recommended action).
 * Uses same priority as enrichIssues: bucket (urgent first), then severity desc, then type.
 */
export function summarizeWorkflowActions(issues: EnrichedIssue[]): {
  topSeverity: number;
  topIssue: EnrichedIssue | null;
  topRecommendedAction: string | null;
} {
  const sorted = [...issues].sort((a, b) => {
    const bucketA = BUCKET_ORDER[a.bucket];
    const bucketB = BUCKET_ORDER[b.bucket];
    if (bucketA !== bucketB) return bucketA - bucketB;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return (a.type ?? "").localeCompare(b.type ?? "", undefined, { sensitivity: "base" });
  });
  const top = sorted[0] ?? null;
  return {
    topSeverity: top?.severity ?? 0,
    topIssue: top,
    topRecommendedAction: top?.copy.recommendedAction ?? null,
  };
}

/**
 * Split enriched issues into urgent vs optimization (for UI sections).
 */
export function getWorkflowBuckets(issues: EnrichedIssue[]): {
  urgent: EnrichedIssue[];
  optimization: EnrichedIssue[];
  hasUrgent: boolean;
  hasOptimization: boolean;
} {
  const urgent = issues.filter((i) => i.bucket === "urgent");
  const optimization = issues.filter((i) => i.bucket === "optimization");
  return {
    urgent,
    optimization,
    hasUrgent: urgent.length > 0,
    hasOptimization: optimization.length > 0,
  };
}

/**
 * Workflow-level bucket from enriched issues.
 * - ≥1 urgent issue → "urgent"
 * - No urgent but ≥1 optimization → "optimization"
 * - No issues → null
 */
export function getWorkflowBucket(
  issuesEnriched: EnrichedIssue[],
): IssueBucket | null {
  if (issuesEnriched.length === 0) return null;
  const hasUrgent = issuesEnriched.some((i) => i.bucket === "urgent");
  if (hasUrgent) return "urgent";
  const hasOptimization = issuesEnriched.some((i) => i.bucket === "optimization");
  return hasOptimization ? "optimization" : null;
}
