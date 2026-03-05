/**
 * Manual validation for Issue Engine (unknown fallback, sorting, top severity).
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' src/lib/action-engine/issueEngine.demo.ts
 * Or run the relevant parts in a test or Node script.
 */

import {
  enrichIssue,
  enrichIssues,
  getWorkflowSeverity,
  summarizeWorkflowActions,
  type WorkflowIssue,
} from "./issueEngine";

function log(label: string, value: unknown) {
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(value, null, 2));
}

// 1) Unknown type fallback
const unknownIssue: WorkflowIssue = { type: "unknown_type" as never };
const enrichedUnknown = enrichIssue(unknownIssue);
log("Unknown type fallback", {
  input: unknownIssue,
  severity: enrichedUnknown.severity,
  copy: enrichedUnknown.copy,
});
console.assert(enrichedUnknown.severity === 30, "Fallback severity should be 30");
console.assert(enrichedUnknown.bucket === "optimization", "Fallback bucket should be optimization");

// 2) Sorting by severity
const issues: WorkflowIssue[] = [
  { type: "info" },
  { type: "broken" },
  { type: "duplicate" },
  { type: "warning" },
];
const sorted = enrichIssues(issues);
log("Sorting (severity desc)", sorted.map((i) => ({ type: i.type, severity: i.severity })));
console.assert(sorted[0].type === "broken" && sorted[0].severity === 100, "First should be broken");
console.assert(sorted[0].bucket === "urgent", "Broken should be urgent bucket");
console.assert(sorted[sorted.length - 1].type === "info", "Last should be info");

// 3) Top severity and summary
const severity = getWorkflowSeverity(sorted);
const summary = summarizeWorkflowActions(sorted);
log("getWorkflowSeverity", severity);
log("summarizeWorkflowActions", summary);
console.assert(severity === 100, "Top severity should be 100");
console.assert(summary.topIssue?.type === "broken", "Top issue should be broken");
console.assert(
  summary.topRecommendedAction?.includes("Open logs"),
  "Top action should recommend opening logs",
);

console.log("\n✅ All assertions passed (manual run).");
