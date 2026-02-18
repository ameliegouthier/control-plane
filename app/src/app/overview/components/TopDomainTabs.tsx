"use client";

import type { WorkflowDomain } from "@/lib/enrichment";

interface TopDomainTabsProps {
  domains: Map<WorkflowDomain, number>;
  selectedDomain: WorkflowDomain | "all";
  onSelectDomain: (domain: WorkflowDomain | "all") => void;
  totalCount: number;
}

export default function TopDomainTabs({
  domains,
  selectedDomain,
  onSelectDomain,
  totalCount,
}: TopDomainTabsProps) {
  const sorted = [...domains.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return (
    <nav
      className="flex items-center justify-center gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Filter by domain"
    >
      <TabButton
        label="All"
        count={totalCount}
        isActive={selectedDomain === "all"}
        onClick={() => onSelectDomain("all")}
      />
      {sorted.map(([domain, count]) => (
        <TabButton
          key={domain}
          label={domain}
          count={count}
          isActive={selectedDomain === domain}
          onClick={() => onSelectDomain(domain)}
        />
      ))}
    </nav>
  );
}

function TabButton({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        isActive
          ? "border-indigo-600 text-zinc-900"
          : "border-transparent text-zinc-400 hover:text-zinc-600"
      }`}
    >
      {label}
      <span
        className={`ml-1.5 text-xs ${
          isActive ? "font-semibold text-indigo-600" : "text-zinc-300"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
