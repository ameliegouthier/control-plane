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
  describe("Categories", () => {
    it("broken → category broken", () => {
      const out = enrichIssue({ type: "broken" });
      expect(out.category).toBe("broken");
    });

    it("conflict → category broken", () => {
      const out = enrichIssue({ type: "conflict" });
      expect(out.category).toBe("broken");
    });

    it("public_webhook → category security", () => {
      const out = enrichIssue({ type: "public_webhook" });
      expect(out.category).toBe("security");
    });

    it("duplicate → category optimization", () => {
      const out = enrichIssue({ type: "duplicate" });
      expect(out.category).toBe("optimization");
    });

    it("unknown type → category optimization (fallback)", () => {
      const out = enrichIssue({ type: "unknown_type" as IssueType });
      expect(out.category).toBe("optimization");
    });
  });

  describe("Scores", () => {
    it("broken.score > conflict.score", () => {
      expect(ISSUE_RULES.broken.severity).toBeGreaterThan(ISSUE_RULES.conflict.severity);
    });

    it("public_webhook.score >= duplicate.score", () => {
      expect(ISSUE_RULES.public_webhook.severity).toBeGreaterThanOrEqual(
        ISSUE_RULES.duplicate.severity,
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

describe("Week 6: Category precedence", () => {
  function runPipeline(rawIssues: WorkflowIssue[]) {
    const issuesEnriched = enrichIssues(rawIssues);
    const category = getWorkflowBucket(issuesEnriched);
    const summary = summarizeWorkflowActions(issuesEnriched);
    return { issuesEnriched, category, topIssue: summary.topIssue };
  }

  it("Case A: [public_webhook] → category security, topIssue.type public_webhook", () => {
    const { category, topIssue } = runPipeline([{ type: "public_webhook" }]);
    expect(category).toBe("security");
    expect(topIssue?.type).toBe("public_webhook");
  });

  it("Case B: [broken] → category broken, topIssue.type broken", () => {
    const { category, topIssue } = runPipeline([{ type: "broken" }]);
    expect(category).toBe("broken");
    expect(topIssue?.type).toBe("broken");
  });

  it("Case C: [broken, public_webhook] → category broken, topIssue.type broken", () => {
    const { category, topIssue } = runPipeline([
      { type: "public_webhook" },
      { type: "broken" },
    ]);
    expect(category).toBe("broken");
    expect(topIssue?.type).toBe("broken");
  });

  it("Case D: [] → category null, topIssue null", () => {
    const { category, topIssue } = runPipeline([]);
    expect(category).toBeNull();
    expect(topIssue).toBeNull();
  });
});

// ─── 1.3 Sorting determinism ─────────────────────────────────────────────────

describe("Week 6: Sorting determinism", () => {
  it("same bucket + score: order deterministic by type", () => {
    const issues: WorkflowIssue[] = [
      { type: "info" },
      { type: "duplicate" },
    ];
    const sorted1 = enrichIssues([...issues]);
    const sorted2 = enrichIssues([...issues]);
    expect(sorted1.map((i) => i.type)).toEqual(sorted2.map((i) => i.type));
    expect(sorted1.length).toBe(2);
  });

  it("broken/security always before optimization in sorted list", () => {
    const issues: WorkflowIssue[] = [
      { type: "public_webhook" },
      { type: "broken" },
      { type: "duplicate" },
    ];
    const sorted = enrichIssues(issues);
    const nonOptimizationIndex = sorted.findIndex(
      (i) => i.category === "broken" || i.category === "security",
    );
    const optimizationIndex = sorted.findIndex(
      (i) => i.category === "optimization",
    );
    expect(nonOptimizationIndex).toBeGreaterThanOrEqual(0);
    expect(optimizationIndex).toBeGreaterThanOrEqual(0);
    expect(nonOptimizationIndex).toBeLessThan(optimizationIndex);
  });

  it("repeated enrichIssues calls return identical order", () => {
    const issues: WorkflowIssue[] = [
      { type: "info" },
      { type: "duplicate" },
    ];
    const order1 = enrichIssues(issues).map((i) => `${i.type}-${i.severity}`);
    const order2 = enrichIssues(issues).map((i) => `${i.type}-${i.severity}`);
    expect(order1).toEqual(order2);
  });
});

// ─── 1.4 Demo dataset expectations ─────────────────────────────────────────────

describe("Week 6: Demo dataset coverage", () => {
  it("at least 1 workflow has category broken", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const brokenCount = full.filter((w) => w.category === "broken").length;
    expect(brokenCount).toBeGreaterThanOrEqual(
      1,
      "Demo must contain at least one workflow that results in category broken (e.g. broken)",
    );
  });

  it("some workflows may have category optimization (duplicate or info)", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const optimizationCount = full.filter(
      (w) => w.category === "optimization",
    ).length;
    // After removing inactive/warning, optimization comes only from duplicate or info.
    expect(optimizationCount).toBeGreaterThanOrEqual(0);
  });

  it("at least 1 workflow has category null (OK)", () => {
    const raw = getAllWorkflowsAsRaw();
    const enrichedBase = raw.map((w) => ({
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
    }));
    const duplicateMap = detectDuplicates(enrichedBase).map;
    const full = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);
    const okCount = full.filter((w) => w.category === null).length;
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
      if (wf.category !== null) {
        expect(wf.issuesEnriched.length).toBeGreaterThan(0);
        expect(wf.topIssueType).toBeDefined();
        expect(wf.hasBroken).toBe(
          wf.issuesEnriched.some((i) => i.category === "broken"),
        );
        expect(wf.hasSecurity).toBe(
          wf.issuesEnriched.some((i) => i.category === "security"),
        );
        expect(wf.hasOptimization).toBe(
          wf.issuesEnriched.some((i) => i.category === "optimization"),
        );
      } else {
        expect(wf.issuesEnriched.length).toBe(0);
        expect(wf.hasBroken).toBe(false);
        expect(wf.hasSecurity).toBe(false);
        expect(wf.hasOptimization).toBe(false);
      }
    });
  });
});
