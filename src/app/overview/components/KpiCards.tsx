import type { HealthStatus } from "@/lib/enrichment";
import { computeSystemHealth as computeHealth } from "@/lib/status-utils";
import { MetricCard } from "@/components/ui";

export const computeSystemHealth = computeHealth;

interface KpiCardsProps {
  totalWorkflows: number;
  connections: number;
  systemHealth: number;
  executionFailures: number;
  activeWorkflows: number;
  idleCount: number;
  brokenCount: number;
  connectionNames: string;
}

function WorkflowsIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ConnectionsIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HealthCheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function FailuresIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export default function KpiCards({
  totalWorkflows,
  connections,
  systemHealth,
  executionFailures,
  activeWorkflows,
  idleCount,
  brokenCount,
  connectionNames,
}: KpiCardsProps) {
  const healthColor =
    systemHealth >= 80
      ? "text-emerald-700"
      : systemHealth >= 60
        ? "text-amber-700"
        : "text-red-600";

  const workflowsDesc = `${activeWorkflows} active · ${idleCount} idle${brokenCount > 0 ? ` · ${brokenCount} broken` : ""}`;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <MetricCard
        title="Workflows"
        value={String(totalWorkflows)}
        description={workflowsDesc}
        icon={<WorkflowsIcon />}
      />
      <MetricCard
        title="System Health"
        value={`${systemHealth}%`}
        description={systemHealth >= 80 ? "All systems operational" : "Needs attention"}
        icon={<HealthCheckIcon />}
        valueClassName={healthColor}
      />
      <MetricCard
        title="Failures (24h)"
        value={String(executionFailures)}
        description={executionFailures > 0 ? "Requires review" : "No failures"}
        valueClassName={executionFailures > 0 ? "text-red-600" : "text-gray-900"}
      />
    </div>
  );
}
