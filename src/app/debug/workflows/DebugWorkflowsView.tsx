"use client";

import { useState } from "react";

// ─── Serializable payload (from server) ─────────────────────────────────────

export type DebugIssueDisplay = {
  type: string;
  severity: number;
  description: string;
};

export type DebugWorkflowPayload = {
  workflowId: string;
  name: string;
  provider: string;
  active: boolean;
  nodesCount: number;
  signalSummary?: string;
  signals: Array<{ type: string; category: string }>;
  issues: DebugIssueDisplay[];
  technical?: {
    workflowId: string;
    triggerType?: string;
    graphNodes?: Array<{
      id: string;
      label: string;
      provider?: string;
      service?: string;
      operation?: string;
    }>;
    enrichment?: {
      domain: string;
      systems: string[];
      output: string;
      health: string;
      riskFlags: string[];
    };
    rawIssues: Array<{ type: string }>;
    enrichedIssues: Array<{
      type: string;
      category: string;
      severity: number;
      impact: string;
      recommendedAction: string;
    }>;
    severity: number;
    category: string | null;
    hasBroken: boolean;
    hasSecurity: boolean;
    hasOptimization: boolean;
    topIssueType?: string;
    topRecommendedAction?: string | null;
    health: string;
    isFilteredFromOptimizationList: boolean;
    filterReason?: string;
  };
};

export type DebugSectionPayload = {
  label: string;
  workflows: DebugWorkflowPayload[];
};

export type OptimizationActionPayload = {
  id: string;
  name: string;
  severity: number;
  issueType: string;
  suggestion: string;
};

export type DebugWorkflowsViewProps = {
  sections: DebugSectionPayload[];
  optimizationActions: OptimizationActionPayload[];
};

const cardStyle = {
  borderRadius: "10px",
  border: "1px solid rgba(148, 163, 184, 0.45)",
  backgroundColor: "#ffffff",
  padding: "16px",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(255,255,255,0.8)",
};

const sectionTitleStyle = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#0f766e",
  marginBottom: "6px",
} as const;

function severityLabel(severity: number): string {
  if (severity >= 70) return "high";
  if (severity >= 40) return "medium";
  return "low";
}

function SeverityBadge({ severity }: { severity: number }) {
  const label = severityLabel(severity);
  const isHigh = label === "high";
  const isMedium = label === "medium";
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "2px 8px",
        borderRadius: "999px",
        border: isHigh
          ? "1px solid rgba(239, 68, 68, 0.8)"
          : isMedium
            ? "1px solid rgba(234, 179, 8, 0.8)"
            : "1px solid rgba(148, 163, 184, 0.7)",
        backgroundColor: isHigh ? "#fef2f2" : isMedium ? "#fef9c3" : "#f1f5f9",
        color: isHigh ? "#b91c1c" : isMedium ? "#92400e" : "#475569",
      }}
    >
      {label}
    </span>
  );
}

export function DebugWorkflowsView({
  sections,
  optimizationActions,
}: DebugWorkflowsViewProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "24px",
        background:
          "radial-gradient(circle at top left, #e0f2fe 0, #f9fafb 40%, #eef2ff 85%)",
        color: "#0f172a",
      }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            marginBottom: "4px",
            color: "#0f172a",
          }}
        >
          /debug/workflows — Optimization pipeline
        </h1>
        <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "640px" }}>
          Debug signals and optimization actions for live workflows. Signals are
          grouped by Security, Alerts, and Optimization.
        </p>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "12px",
            fontSize: "13px",
            color: "#475569",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showTechnical}
            onChange={(e) => setShowTechnical(e.target.checked)}
          />
          Show technical debug data
        </label>
      </header>

      {sections.map((section) => (
        <section
          key={section.label}
          style={{
            marginBottom: "24px",
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(148, 163, 184, 0.5)",
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
          }}
        >
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
              color: "#0f172a",
            }}
          >
            {section.label}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {section.workflows.length === 0 && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#6b7280",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(148, 163, 184, 0.6)",
                  backgroundColor: "#f9fafb",
                }}
              >
                No workflows in this dataset.
              </div>
            )}

            {section.workflows.map((wf) => (
              <article key={wf.workflowId} style={cardStyle}>
                {/* 1. Workflow Info (simplified) */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={sectionTitleStyle}>Workflow Info</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px 16px",
                      fontSize: "13px",
                      color: "#374151",
                    }}
                  >
                    <span>
                      <strong>Name:</strong> {wf.name}
                    </span>
                    <span>
                      <strong>Provider:</strong> {wf.provider}
                    </span>
                    <span>
                      <strong>Active:</strong> {wf.active ? "Yes" : "No"}
                    </span>
                    <span>
                      <strong>Nodes:</strong> {wf.nodesCount}
                    </span>
                  </div>
                </div>

                {/* 2. Signals grouped by category: Security, Alerts, Optimization */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={sectionTitleStyle}>Signals</div>
                  {wf.signals.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      No signals detected
                    </div>
                  ) : (
                    (() => {
                      const byCategory = {
                        security: wf.signals.filter(
                          (s) => s.category === "security",
                        ),
                        alerts: wf.signals.filter(
                          (s) => s.category === "alerts",
                        ),
                        optimization: wf.signals.filter(
                          (s) => s.category === "optimization",
                        ),
                      };
                      const categories = [
                        {
                          label: "Security",
                          signals: byCategory.security,
                        },
                        {
                          label: "Alerts",
                          signals: byCategory.alerts,
                        },
                        {
                          label: "Optimization",
                          signals: byCategory.optimization,
                        },
                      ] as const;
                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          {categories.map(
                            (cat) =>
                              cat.signals.length > 0 && (
                                <div key={cat.label}>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      color: "#64748b",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    {cat.label}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "6px",
                                    }}
                                  >
                                    {cat.signals.map((s, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: "12px",
                                          padding: "4px 10px",
                                          borderRadius: "6px",
                                          border:
                                            "1px solid rgba(148, 163, 184, 0.6)",
                                          backgroundColor: "#f8fafc",
                                          color: "#334155",
                                        }}
                                      >
                                        [{s.type.replace(/_/g, "-")}]
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ),
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Technical Debug Data (collapsible) */}
                {showTechnical && wf.technical && (
                  <details
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid rgba(148, 163, 184, 0.4)",
                    }}
                    open
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "11px",
                        color: "#64748b",
                        marginBottom: "8px",
                      }}
                    >
                      Technical Debug Data
                    </summary>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        fontSize: "11px",
                        color: "#374151",
                      }}
                    >
                      {wf.technical.graphNodes &&
                        wf.technical.graphNodes.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "#64748b",
                                marginBottom: "4px",
                              }}
                            >
                              Graph nodes ({wf.technical.graphNodes.length})
                            </div>
                            <ul
                              style={{
                                listStyle: "none",
                                margin: 0,
                                padding: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              {wf.technical.graphNodes.map((node, idx) => (
                                <li
                                  key={node.id}
                                  style={{
                                    padding: "6px 8px",
                                    borderRadius: "6px",
                                    border: "1px solid rgba(148, 163, 184, 0.4)",
                                    backgroundColor: "#f8fafc",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  #{idx + 1} {node.label} ·{" "}
                                  {node.service ?? "—"} ·{" "}
                                  {node.operation ?? "—"}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {wf.technical.enrichment && (
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#64748b",
                              marginBottom: "4px",
                            }}
                          >
                            System map / Enrichment
                          </div>
                          <div>
                            domain: {wf.technical.enrichment.domain} · systems:{" "}
                            {wf.technical.enrichment.systems.join(", ") || "—"} ·
                            health: {wf.technical.enrichment.health}
                          </div>
                        </div>
                      )}

                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: "4px",
                          }}
                        >
                          Workflow summary
                        </div>
                        <div>
                          severity: {wf.technical.severity} · category:{" "}
                          {wf.technical.category ?? "null"} · hasOptimization:{" "}
                          {String(wf.technical.hasOptimization)}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: "4px",
                          }}
                        >
                          Optimization filter diagnostics
                        </div>
                        <div>
                          health: {wf.technical.health} ·
                          isFilteredFromOptimizationList:{" "}
                          {String(wf.technical.isFilteredFromOptimizationList)}
                          {wf.technical.filterReason && (
                            <> · {wf.technical.filterReason}</>
                          )}
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: "4px",
                          }}
                        >
                          Full workflow metadata
                        </div>
                        <div>
                          id: {wf.technical.workflowId} · triggerType:{" "}
                          {wf.technical.triggerType ?? "—"}
                        </div>
                      </div>
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {/* Final Optimization Actions */}
      <section
        style={{
          marginTop: "28px",
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(148, 163, 184, 0.6)",
          backgroundColor: "#ffffff",
          boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "4px",
            color: "#0f172a",
          }}
        >
          Final Optimization Actions
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "#6b7280",
            marginBottom: "12px",
          }}
        >
          Workflows with optimization issues (health ≠ broken), ordered by
          severity.
        </p>

        {optimizationActions.length === 0 ? (
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid rgba(148, 163, 184, 0.6)",
              backgroundColor: "#f9fafb",
            }}
          >
            No optimization actions
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {optimizationActions.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(234, 179, 8, 0.6)",
                  backgroundColor: "#fffbeb",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#111827",
                    marginBottom: "4px",
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    Issue: {item.issueType.replace(/_/g, " ")}
                  </span>
                  <SeverityBadge severity={item.severity} />
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#374151",
                  }}
                >
                  {item.suggestion}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
