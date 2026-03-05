/**
 * Week 6 End-of-Week Test: Urgent vs Optimization + Action Center + Demo Data
 *
 * Validates:
 * - Action Engine rules (bucket + score + copy)
 * - Workflow enrichment (issuesEnriched + bucket + topIssue)
 * - Bucket precedence and sorting determinism
 * - Demo dataset has at least one urgent, one optimization, one OK workflow
 */

import { describe, it, expect } from "vitest";
import {
  ISSUE_RULES,
  DEFAULT_RULE,
  enrichIssue,
  enrichIssues,
  getWorkflowBucket,
  summarizeWorkflowActions,
  type WorkflowIssue,
  type IssueType,
} from "../issueEngine";
import {
  getEnrichmentForWorkflow,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
} from "@/lib/enrichment";
import { getAllWorkflowsAsRaw } from "@/lib/repositories/workflowsRepository";

// ─── 1.1 Issue Engine rules ───────────────────────────────────────────────────

describe("Week 6: Issue engine rules", () => {
  describe("Buckets", () => {
    it("broken → bucket urgent", () => {
      const out = enrichIssue({ type: "broken" });
      expect(out.bucket).toBe("urgent");
    });

    it("conflict → bucket urgent", () => {
      const out = enrichIssue({ type: "conflict" });
      expect(out.bucket).toBe("urgent");
    });

    it("public_webhook → bucket optimization", () => {
      const out = enrichIssue({ type: "public_webhook" });
      expect(out.bucket).toBe("optimization");
    });

    it("duplicate → bucket optimization", () => {
      const out = enrichIssue({ type: "duplicate" });
      expect(out.bucket).toBe("optimization");
    });

    it("unknown type → bucket optimization (fallback)", () => {
      const out = enrichIssue({ type: "unknown_type" as IssueType });
      expect(out.bucket).toBe("optimization");
    });
  });

  describe("Scores", () => {
    it("broken.score > conflict.score", () => {
      expect(ISSUE_RULES.broken.severity).toBeGreaterThan(ISSUE_RULES.conflict.severity);
    });

    it("public_webhook.score >= inactive.score", () => {
      expect(ISSUE_RULES.public_webhook.severity).toBeGreaterThanOrEqual(
        ISSUE_RULES.inactive.severity,
      );
    });

    it("unknown fallback score equals DEFAULT_RULE severity", () => {
      const out = enrichIssue({ type: "unknown_xyz" as IssueType });
      expect(out.severity).toBe(DEFAULT_RULE.severity);
      expect(DEFAULT_RULE.severity).toBe(30);
    });
  });

  describe("Copy", () => {
    const knownTypes: IssueType[] = [
      "broken",
      "conflict",
      "public_webhook",
      "duplicate",
      "inactive",
      "warning",
      "info",
    ];

    knownTypes.forEach((type) => {
      it(`${type} has non-empty impact, why, recommendedAction`, () => {
        const out = enrichIssue({ type });
        expect(out.copy.impact).toBeDefined();
        expect(out.copy.impact.trim().length).toBeGreaterThan(0);
        expect(out.copy.why).toBeDefined();
        expect(out.copy.why.trim().length).toBeGreaterThan(0);
        expect(out.copy.recommendedAction).toBeDefined();
        expect(out.copy.recommendedAction.trim().length).toBeGreaterThan(0);
      });
    });

    it("unknown type gets non-empty fallback copy", () => {
      const out = enrichIssue({ type: "unknown" as IssueType });
      expect(out.copy.impact).toBeDefined();
      expect(out.copy.impact.trim().length).toBeGreaterThan(0);
      expect(out.copy.why).toBeDefined();
      expect(out.copy.recommendedAction).toBeDefined();
    });
  });
});

// ─── 1.2 Enrichment split + precedence ─────────────────────────────────────────

describe("Week 6: Bucket precedence", () => {
  function runPipeline(rawIssues: WorkflowIssue[]) {
    const issuesEnriched = enrichIssues(rawIssues);
    const bucket = getWorkflowBucket(issuesEnriched);
    const summary = summarizeWorkflowActions(issuesEnriched);
    return { issuesEnriched, bucket, topIssue: summary.topIssue };
  }

  it("Case A: [public_webhook] → bucket optimization, topIssue.type public_webhook", () => {
    const { bucket, topIssue } = runPipeline([{ type: "public_webhook" }]);
    expect(bucket).toBe("optimization");
    expect(topIssue?.type).toBe("public_webhook");
  });

  it("Case B: [broken] → bucket urgent, topIssue.type broken", () => {
    const { bucket, topIssue } = runPipeline([{ type: "broken" }]);
    expect(bucket).toBe("urgent");
    expect(topIssue?.type).toBe("broken");
  });

  it("Case C: [broken, public_webhook] → bucket urgent, topIssue.type broken", () => {
    const { bucket, topIssue } = runPipeline([
      { type: "public_webhook" },
      { type: "broken" },
    ]);
    expect(bucket).toBe("urgent");
    expect(topIssue?.type).toBe("broken");
  });

  it("Case D: [] → bucket null, topIssue null", () => {
    const { bucket, topIssue } = runPipeline([]);
    expect(bucket).toBeNull();
    expect(topIssue).toBeNull();
  });
});

// ─── 1.3 Sorting determinism ─────────────────────────────────────────────────

describe("Week 6: Sorting determinism", () => {
  it("same bucket + score: order deterministic by type", () => {
    const issues: WorkflowIssue[] = [
      { type: "warning" },
      { type: "inactive" },
    ];
    const sorted1 = enrichIssues([...issues]);
    const sorted2 = enrichIssues([...issues]);
    expect(sorted1.map((i) => i.type)).toEqual(sorted2.map((i) => i.type));
    expect(sorted1.length).toBe(2);
  });

  it("urgent always before optimization in sorted list", () => {
    const issues: WorkflowIssue[] = [
      { type: "public_webhook" },
      { type: "broken" },
      { type: "duplicate" },
    ];
    const sorted = enrichIssues(issues);
    const urgentIndex = sorted.findIndex((i) => i.bucket === "urgent");
    const optimizationIndex = sorted.findIndex((i) => i.bucket === "optimization");
    expect(urgentIndex).toBeGreaterThanOrEqual(0);
    expect(optimizationIndex).toBeGreaterThanOrEqual(0);
    expect(urgentIndex).toBeLessThan(optimizationIndex);
  });

  it("repeated enrichIssues calls return identical order", () => {
    const issues: WorkflowIssue[] = [
      { type: "info" },
      { type: "warning" },
      { type: "duplicate" },
    ];
    const order1 = enrichIssues(issues).map((i) => `${i.type}-${i.severity}`);
    const order2 = enrichIssues(issues).map((i) => `${i.type}-${i.severity}`);
    expect(order1).toEqual(order2);
  });
});

// ─── 1.4 Demo dataset expectations ─────────────────────────────────────────────

describe("Week 6: Demo dataset coverage", () => {
  it("at least 1 workflow has bucket urgent", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const urgentCount = full.filter((w) => w.bucket === "urgent").length;
    expect(urgentCount).toBeGreaterThanOrEqual(
      1,
      "Demo must contain at least one workflow that results in bucket urgent (e.g. broken)",
    );
  });

  it("at least 1 workflow has bucket optimization", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const optimizationCount = full.filter((w) => w.bucket === "optimization").length;
    expect(optimizationCount).toBeGreaterThanOrEqual(
      1,
      "Demo must contain at least one workflow that results in bucket optimization (e.g. public_webhook)",
    );
  });

  it("at least 1 workflow has bucket null (OK)", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const okCount = full.filter((w) => w.bucket === null).length;
    expect(okCount).toBeGreaterThanOrEqual(
      1,
      "Demo must contain at least one workflow with no issues (bucket null)",
    );
  });

  it("full pipeline produces issuesEnriched and topIssueType where bucket is set", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);

    full.forEach((wf) => {
      expect(wf.issuesEnriched).toBeDefined();
      expect(Array.isArray(wf.issuesEnriched)).toBe(true);
      if (wf.bucket !== null) {
        expect(wf.issuesEnriched.length).toBeGreaterThan(0);
        expect(wf.topIssueType).toBeDefined();
        expect(wf.hasUrgent).toBe(wf.issuesEnriched.some((i) => i.bucket === "urgent"));
        expect(wf.hasOptimization).toBe(wf.issuesEnriched.some((i) => i.bucket === "optimization"));
      } else {
        expect(wf.issuesEnriched.length).toBe(0);
        expect(wf.hasUrgent).toBe(false);
        expect(wf.hasOptimization).toBe(false);
      }
    });
  });
});
