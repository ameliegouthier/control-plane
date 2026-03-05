import type { HealthStatus } from "@/lib/enrichment";

const HEALTH_SCORE: Record<HealthStatus, number> = {
  ok: 100,
  optimizable: 80,
  warning: 60,
  broken: 20,
};

export function computeSystemHealth(healthValues: HealthStatus[]): number {
  if (healthValues.length === 0) return 0;
  const total = healthValues.reduce((sum, h) => sum + (HEALTH_SCORE[h] ?? 0), 0);
  return Math.round(total / healthValues.length);
}

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

function WorkflowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ConnectionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="M4.93 19.07l2.83-2.83" /><path d="M16.24 7.76l2.83-2.83" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HealthCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function FailuresIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  valueClassName = "text-neutral-900",
  iconClassName = "text-neutral-400",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className="relative flex flex-col rounded-lg border border-neutral-200 bg-white px-5 py-4">
      <div className="absolute right-3 top-3 text-neutral-300">
        <Icon className={iconClassName} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
        {title}
      </p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
    </div>
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
      ? "text-emerald-600"
      : systemHealth >= 60
        ? "text-amber-600"
        : "text-red-600";

  const workflowsDesc = `${activeWorkflows} active · ${idleCount} idle${brokenCount > 0 ? ` · ${brokenCount} broken` : ""}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        title="Workflows"
        value={String(totalWorkflows)}
        description={workflowsDesc}
        icon={WorkflowsIcon}
      />
      <MetricCard
        title="Connections"
        value={String(connections)}
        description={connectionNames}
        icon={ConnectionsIcon}
      />
      <MetricCard
        title="System Health"
        value={`${systemHealth}%`}
        description={systemHealth >= 80 ? "All systems operational" : "Needs attention"}
        icon={HealthCheckIcon}
        valueClassName={healthColor}
        iconClassName={systemHealth >= 80 ? "text-emerald-500" : "text-neutral-400"}
      />
      <MetricCard
        title="Failures (24h)"
        value={String(executionFailures)}
        description={executionFailures > 0 ? "Requires review" : "No failures"}
        icon={FailuresIcon}
        valueClassName={executionFailures > 0 ? "text-red-600" : "text-neutral-900"}
        iconClassName={executionFailures > 0 ? "text-red-400" : "text-neutral-400"}
      />
    </div>
  );
}
