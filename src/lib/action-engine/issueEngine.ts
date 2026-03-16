/**
 * Action Engine v0 — Issue severity, category, and copy.
 * Provider-agnostic; single source of truth for issue priority and messaging.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Product-facing categories for issues. */
export type IssueCategory = "broken" | "security" | "optimization";

/** Extensible union of issue types (aligned with detection). */
export type IssueType =
  | "broken"
  | "conflict"
  | "public_webhook"
  | "duplicate"
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

/** Issue with category, severity and copy (output of issue engine). */
export type EnrichedIssue = WorkflowIssue & {
  category: IssueCategory;
  severity: number;
  copy: IssueCopy;
};

// ─── Rules (single source of truth) ───────────────────────────────────────────

export interface IssueRule {
  category: IssueCategory;
  severity: number;
  copy: IssueCopy;
}

/** Single fallback for unknown issue types: optimization, score 30, generic copy. */
export const DEFAULT_RULE: IssueRule = {
  category: "optimization",
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
    category: "broken",
    severity: 100,
    copy: {
      impact: "Automation is not running reliably.",
      why: "Failing workflows create silent operational gaps.",
      recommendedAction:
        "Open logs, fix the failing node, re-run a test execution.",
    },
  },
  conflict: {
    category: "broken",
    severity: 90,
    copy: {
      impact: "Two workflows may trigger the same downstream action.",
      why: "Conflicts cause duplicate CRM updates or double notifications.",
      recommendedAction:
        "Clarify ownership and disable/merge the redundant logic.",
    },
  },
  public_webhook: {
    category: "security",
    severity: 80,
    copy: {
      impact: "Endpoint can be triggered without authentication.",
      why: "Increases security risk and untrusted executions.",
      recommendedAction:
        "Add auth, rotate URL, restrict access, or disable webhook.",
    },
  },
  duplicate: {
    category: "optimization",
    severity: 70,
    copy: {
      impact: "Same automation exists multiple times.",
      why: "Harder maintenance and higher risk of inconsistencies.",
      recommendedAction:
        "Keep one source of truth and archive the duplicates.",
    },
  },
  info: {
    category: "optimization",
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
 * Enrich a single raw issue with category, severity and copy.
 * Unknown types use DEFAULT_RULE (optimization category, score 30, generic copy).
 */
export function enrichIssue(issue: WorkflowIssue): EnrichedIssue {
  const rule = ISSUE_RULES[issue.type as IssueType];
  const { category, severity, copy } = rule ?? DEFAULT_RULE;
  return {
    ...issue,
    category,
    severity,
    copy,
  };
}

/** Category order for stable sort: broken → security → optimization. */
const CATEGORY_ORDER: Record<IssueCategory, number> = {
  broken: 0,
  security: 1,
  optimization: 2,
};

/**
 * Enrich all issues and sort with stable priority:
 * 1. Category (broken, then security, then optimization)
 * 2. Score descending
 * 3. Type ascending (deterministic tie-break)
 */
export function enrichIssues(issues: WorkflowIssue[]): EnrichedIssue[] {
  const enriched = issues.map(enrichIssue);
  return enriched.sort((a, b) => {
    const categoryA = CATEGORY_ORDER[a.category];
    const categoryB = CATEGORY_ORDER[b.category];
    if (categoryA !== categoryB) return categoryA - categoryB;
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
   * Uses same priority as enrichIssues: category (broken, then security, then optimization), then severity desc, then type.
 */
export function summarizeWorkflowActions(issues: EnrichedIssue[]): {
  topSeverity: number;
  topIssue: EnrichedIssue | null;
  topRecommendedAction: string | null;
} {
  const sorted = [...issues].sort((a, b) => {
    const categoryA = CATEGORY_ORDER[a.category];
    const categoryB = CATEGORY_ORDER[b.category];
    if (categoryA !== categoryB) return categoryA - categoryB;
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
 * Split enriched issues into categories (for UI sections).
 */
export function getWorkflowBuckets(issues: EnrichedIssue[]): {
  broken: EnrichedIssue[];
  security: EnrichedIssue[];
  optimization: EnrichedIssue[];
  hasBroken: boolean;
  hasSecurity: boolean;
  hasOptimization: boolean;
} {
  const broken = issues.filter((i) => i.category === "broken");
  const security = issues.filter((i) => i.category === "security");
  const optimization = issues.filter((i) => i.category === "optimization");
  return {
    broken,
    security,
    optimization,
    hasBroken: broken.length > 0,
    hasSecurity: security.length > 0,
    hasOptimization: optimization.length > 0,
  };
}

/**
 * Workflow-level category from enriched issues.
 * - ≥1 broken issue → "broken"
 * - No broken but ≥1 security issue → "security"
 * - No broken/security but ≥1 optimization → "optimization"
 * - No issues → null
 */
export function getWorkflowBucket(
  issuesEnriched: EnrichedIssue[],
): IssueCategory | null {
  if (issuesEnriched.length === 0) return null;
  const hasBroken = issuesEnriched.some((i) => i.category === "broken");
  if (hasBroken) return "broken";
  const hasSecurity = issuesEnriched.some((i) => i.category === "security");
  if (hasSecurity) return "security";
  const hasOptimization = issuesEnriched.some((i) => i.category === "optimization");
  return hasOptimization ? "optimization" : null;
}
