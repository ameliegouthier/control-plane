"use client";

import { useState } from "react";
import {
  Badge,
  StatusDot,
  RiskScoreBadge,
  EmptyState,
  FilterGroup,
  ActionListItem,
  SectionHeader,
  MetricCard,
  // icons
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowIcon,
  AlertTriangleIcon,
  FailuresIcon,
  HealthCheckIcon,
  TrashIcon,
  ExternalLinkIcon,
  OptimizationIcon,
  ZapIcon,
  WorkflowsIcon,
  ConnectionsIcon,
  GitBranchIcon,
} from "@/components/ui";
import { NodeCard } from "@/components/workflows/nodes/NodeCard";

// ─── Helper ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-[13px] font-semibold text-gray-900 tracking-tight whitespace-nowrap">
          {title}
        </h2>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      {children}
    </section>
  );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-4 ${className}`}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{children}</p>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── Section 5 — FilterGroup (stateful) ──────────────────────────────────────

function FilterGroupDemo() {
  const [value, setValue] = useState("all");
  const options = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Paused", value: "paused" },
  ];
  return (
    <div>
      <FilterGroup options={options} value={value} onChange={setValue} />
      <p className="mt-3 text-[11px] text-gray-400">
        Selected: <span className="text-gray-700 font-medium">{value}</span>
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComponentsShowcasePage() {
  return (
    <main className="ml-[80px] min-h-screen bg-white px-12 py-10">
      <div className="max-w-4xl">

        {/* Page title */}
        <div className="mb-12">
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            Component Showcase
          </h1>
          <p className="mt-1 text-[13px] text-gray-400">
            All UI components with all variants — dev only, no auth required.
          </p>
        </div>

        {/* ── Section 1 — Badge ─────────────────────────────────────────── */}
        <Section title="1 — Badge">
          <Row>
            <Cell label="default">
              <Badge variant="default">Default</Badge>
            </Cell>
            <Cell label="success">
              <Badge variant="success">Success</Badge>
            </Cell>
            <Cell label="warning">
              <Badge variant="warning">Warning</Badge>
            </Cell>
            <Cell label="error">
              <Badge variant="error">Error</Badge>
            </Cell>
            <Cell label="neutral">
              <Badge variant="neutral">Neutral</Badge>
            </Cell>
          </Row>
        </Section>

        {/* ── Section 2 — StatusDot ─────────────────────────────────────── */}
        <Section title="2 — StatusDot">
          <Row>
            {(["success", "warning", "error", "neutral", "muted"] as const).map((v) => (
              <Cell key={v} label={v}>
                <div className="flex items-center gap-2">
                  <StatusDot variant={v} />
                  <span className="text-[11px] text-gray-500">static</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusDot variant={v} pulse />
                  <span className="text-[11px] text-gray-500">pulse</span>
                </div>
              </Cell>
            ))}
          </Row>
        </Section>

        {/* ── Section 3 — RiskScoreBadge ────────────────────────────────── */}
        <Section title="3 — RiskScoreBadge">
          <div className="space-y-6">
            <div>
              <Label>size="md"</Label>
              <Row>
                <RiskScoreBadge score={87} size="md" />
                <RiskScoreBadge score={54} size="md" />
                <RiskScoreBadge score={12} size="md" />
              </Row>
            </div>
            <div>
              <Label>size="sm" — inline</Label>
              <p className="text-[13px] text-gray-700 flex items-center gap-2 flex-wrap">
                Workflow A has risk score
                <RiskScoreBadge score={87} size="sm" />
                — Workflow B has score
                <RiskScoreBadge score={54} size="sm" />
                — Workflow C has score
                <RiskScoreBadge score={12} size="sm" />
              </p>
            </div>
          </div>
        </Section>

        {/* ── Section 4 — EmptyState ────────────────────────────────────── */}
        <Section title="4 — EmptyState">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>default</Label>
              <EmptyState
                message="No workflows found."
                submessage="Try adjusting your filters."
                variant="default"
              />
            </div>
            <div>
              <Label>success</Label>
              <EmptyState
                message="All systems operational."
                submessage="Nothing to fix right now."
                variant="success"
              />
            </div>
            <div>
              <Label>info</Label>
              <EmptyState
                message="Sync in progress."
                submessage="Check back in a few seconds."
                variant="info"
              />
            </div>
          </div>
        </Section>

        {/* ── Section 5 — FilterGroup ───────────────────────────────────── */}
        <Section title="5 — FilterGroup">
          <FilterGroupDemo />
        </Section>

        {/* ── Section 6 — ActionListItem ────────────────────────────────── */}
        <Section title="6 — ActionListItem">
          <div className="space-y-2 max-w-md">
            <Cell label="urgent">
              <ActionListItem
                variant="urgent"
                icon={<AlertTriangleIcon className="w-3.5 h-3.5" />}
                title="Broken workflow"
                description="Slack Notifier — This workflow has a broken connection to the Slack API."
                href="#"
              />
            </Cell>
            <Cell label="optimization">
              <ActionListItem
                variant="optimization"
                icon={<OptimizationIcon className="w-3.5 h-3.5" />}
                title="Redundant steps detected"
                description="Airtable Sync — Three consecutive Set nodes can be merged into one."
                href="#"
              />
            </Cell>
            <Cell label="default">
              <ActionListItem
                variant="default"
                icon={<ZapIcon className="w-3.5 h-3.5" />}
                title="CRM Lead Enrichment"
                description="HubSpot — Workflow triggered 142 times in the last 7 days."
                href="#"
              />
            </Cell>
          </div>
        </Section>

        {/* ── Section 7 — SectionHeader ─────────────────────────────────── */}
        <Section title="7 — SectionHeader">
          <div className="space-y-6 max-w-lg">
            <div>
              <Label>accent red — with count</Label>
              <SectionHeader title="Action Center" accent="bg-red-400" count={7} />
            </div>
            <div>
              <Label>accent blue — with count</Label>
              <SectionHeader title="Workflows" accent="bg-blue-400" count={47} />
            </div>
            <div>
              <Label>accent emerald — no count</Label>
              <SectionHeader title="System Map" accent="bg-emerald-400" />
            </div>
          </div>
        </Section>

        {/* ── Section 8 — MetricCard ────────────────────────────────────── */}
        <Section title="8 — MetricCard">
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              title="Workflows"
              value="47"
              description="12 active · 3 broken"
              icon={<WorkflowsIcon className="w-3.5 h-3.5" />}
            />
            <MetricCard
              title="Connections"
              value="3"
              description="n8n · make · zapier"
              icon={<ConnectionsIcon className="w-3.5 h-3.5" />}
            />
            <MetricCard
              title="System Health"
              value="91%"
              description="Good — 2 warnings"
              icon={<HealthCheckIcon className="w-3.5 h-3.5" />}
              valueClassName="text-emerald-600"
            />
            <MetricCard
              title="Failures (24h)"
              value="2"
              description="Last: 3h ago"
              icon={<FailuresIcon className="w-3.5 h-3.5" />}
              valueClassName="text-red-500"
            />
          </div>
        </Section>

        {/* ── Section 9 — Icons ─────────────────────────────────────────── */}
        <Section title="9 — Icons">
          <div className="grid grid-cols-8 gap-x-6 gap-y-6">
            {[
              { name: "ChevronRightIcon", el: <ChevronRightIcon className="w-5 h-5 text-gray-600" /> },
              { name: "ChevronLeftIcon",  el: <ChevronLeftIcon  className="w-5 h-5 text-gray-600" /> },
              { name: "ChevronDownIcon",  el: <ChevronDownIcon  className="w-5 h-5 text-gray-600" /> },
              { name: "ArrowLeftIcon",    el: <ArrowLeftIcon    className="w-5 h-5 text-gray-600" /> },
              { name: "ArrowRightIcon",   el: <ArrowRightIcon   className="w-5 h-5 text-gray-600" /> },
              { name: "ArrowIcon",        el: <ArrowIcon /> },
              { name: "AlertTriangleIcon",el: <AlertTriangleIcon className="w-5 h-5 text-gray-600" /> },
              { name: "FailuresIcon",     el: <FailuresIcon     className="w-5 h-5 text-gray-600" /> },
              { name: "HealthCheckIcon",  el: <HealthCheckIcon  className="w-5 h-5 text-gray-600" /> },
              { name: "TrashIcon",        el: <TrashIcon        className="w-5 h-5 text-gray-600" /> },
              { name: "ExternalLinkIcon", el: <ExternalLinkIcon className="w-5 h-5 text-gray-600" /> },
              { name: "OptimizationIcon", el: <OptimizationIcon className="w-5 h-5 text-gray-600" /> },
              { name: "ZapIcon",          el: <ZapIcon          className="w-5 h-5 text-gray-600" /> },
              { name: "WorkflowsIcon",    el: <WorkflowsIcon    className="w-5 h-5 text-gray-600" /> },
              { name: "ConnectionsIcon",  el: <ConnectionsIcon  className="w-5 h-5 text-gray-600" /> },
              { name: "GitBranchIcon",    el: <GitBranchIcon    className="w-5 h-5 text-gray-600" /> },
            ].map(({ name, el }) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100">
                  {el}
                </div>
                <span className="text-[9px] text-gray-400 text-center leading-tight">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 10 — NodeCard ─────────────────────────────────────── */}
        <Section title="10 — NodeCard">
          <div className="flex flex-wrap gap-4">
            <div>
              <Label>trigger</Label>
              <NodeCard themeKey="trigger" label="Webhook received" service="HTTP" />
            </div>
            <div>
              <Label>agent</Label>
              <NodeCard themeKey="agent" label="Classify intent" service="OpenAI" />
            </div>
            <div>
              <Label>output</Label>
              <NodeCard themeKey="output" label="Send Slack message" service="Slack" />
            </div>
            <div>
              <Label>condition</Label>
              <NodeCard themeKey="condition" label="Is priority?" />
            </div>
            <div>
              <Label>action</Label>
              <NodeCard themeKey="action" label="Create HubSpot deal" service="HubSpot" />
            </div>
            <div>
              <Label>tool</Label>
              <NodeCard themeKey="tool" label="Search knowledge base" service="Pinecone" />
            </div>
          </div>
        </Section>

      </div>
    </main>
  );
}
