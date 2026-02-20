"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type Workflow,
  type MiniMapNode,
  getTriggerSummary,
  getActionPills,
  getSignals,
  formatNodeType,
  buildMiniMap,
} from "./workflow-helpers";
import {
  type WorkflowIntent,
  generateDraftIntent,
} from "../lib/intent";
import ConnectProviderModal from "./connect-provider-modal";
import { getAllWorkflows } from "@/lib/repositories/workflowsRepository";
import {
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
} from "../lib/demo/demoMode";

// ─── Tool Sidebar ────────────────────────────────────────────────────────────

const TOOLS = [
  { id: "n8n", name: "n8n", enabled: true, icon: "⚡" },
  { id: "zapier", name: "Zapier", enabled: false, icon: "🔶" },
  { id: "make", name: "Make", enabled: false, icon: "🟣" },
] as const;

function ToolSidebar({
  selected,
  onSelect,
  onConnectN8n,
  n8nConnected,
  isDemo,
  onDisableDemo,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onConnectN8n: () => void;
  n8nConnected: boolean;
  isDemo: boolean;
  onDisableDemo: () => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
          CP
        </div>
        <span className="text-sm font-semibold text-zinc-900">
          Control Plane
        </span>
      </div>
      <div className="px-5 pt-5 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Tools
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {TOOLS.map((tool) => {
          const isSelected = selected === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              disabled={!tool.enabled}
              onClick={() => tool.enabled && onSelect(tool.id)}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isSelected
                  ? "bg-indigo-50 font-medium text-indigo-700"
                  : tool.enabled
                    ? "text-zinc-700 hover:bg-zinc-50"
                    : "cursor-not-allowed text-zinc-300"
              }`}
            >
              <span className="text-base">{tool.icon}</span>
              <span>{tool.name}</span>
              {!tool.enabled && (
                <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  Soon
                </span>
              )}
              {tool.id === "n8n" && !isDemo && (
                <span
                  role="button"
                  tabIndex={0}
                  title={n8nConnected ? "Reconnect n8n" : "Connect n8n"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnectN8n();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.stopPropagation(); onConnectN8n(); }
                  }}
                  className={`ml-auto flex h-5 w-5 items-center justify-center rounded-md transition ${
                    n8nConnected
                      ? "group-hover:bg-indigo-50"
                      : "text-zinc-400 hover:bg-indigo-100 hover:text-indigo-600"
                  }`}
                >
                  {n8nConnected ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M8 3v10M3 8h10" />
                    </svg>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Demo mode badge */}
      {isDemo && (
        <div className="mx-3 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-[11px] font-semibold text-amber-700">
              Demo mode
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-amber-600/80">
            Using sample data.
          </p>
          <button
            type="button"
            onClick={onDisableDemo}
            className="mt-1.5 text-[10px] font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 transition hover:text-amber-900"
          >
            Disable demo mode
          </button>
        </div>
      )}

      <div className="mt-auto border-t border-zinc-200 p-4">
        <p className="text-[11px] text-zinc-400">MVP v0.1</p>
      </div>
    </aside>
  );
}

// ─── Reusable pill ──────────────────────────────────────────────────────────

function Pill({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "indigo" | "amber" | "sky" | "violet";
}) {
  const styles = {
    default: "bg-zinc-100 text-zinc-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

// ─── Workflow List (middle) ─────────────────────────────────────────────────

function WorkflowListPanel({
  workflows,
  selectedId,
  onSelect,
  intents,
  isConnected,
}: {
  workflows: Workflow[];
  selectedId: string | null;
  onSelect: (wf: Workflow) => void;
  intents: Record<string, WorkflowIntent>;
  isConnected: boolean;
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex h-14 items-center border-b border-zinc-200 px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Workflows</h2>
        <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
          {workflows.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {workflows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-2xl">{isConnected ? "📭" : "🔌"}</span>
            <p className="text-sm font-medium text-zinc-500">
              {isConnected ? "No workflows yet" : "Not connected"}
            </p>
            <p className="text-xs text-zinc-400">
              {isConnected
                ? "Your synced workflows will appear here."
                : "Connect n8n to sync your workflows."}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {workflows.map((wf) => {
            const isSelected = wf.id === selectedId;
            const trigger = getTriggerSummary(wf.graph);
            const actions = getActionPills(wf.graph);
            const signals = getSignals(wf.graph);
            const intent = intents[wf.id];

            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => onSelect(wf)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  isSelected
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : "border-transparent bg-white hover:border-zinc-200 hover:shadow-sm"
                }`}
              >
                {/* Row 1: name + status */}
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm font-medium leading-tight ${
                      isSelected ? "text-indigo-900" : "text-zinc-900"
                    }`}
                  >
                    {wf.name}
                  </span>
                  <span
                    className={`ml-auto inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      wf.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {wf.active ? "Active" : "Paused"}
                  </span>
                </div>

                {/* Row 2: intent summary */}
                {intent && (
                  <p className="mt-1 truncate text-[11px] leading-snug text-zinc-500">
                    {intent.summary}
                  </p>
                )}

                {/* Row 3: trigger + meta */}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="truncate font-medium text-zinc-500">
                    {trigger.label}
                  </span>
                  <span>·</span>
                  <span className="shrink-0">{wf.graph?.nodes.length ?? 0} nodes</span>
                  <span>·</span>
                  <span className="shrink-0">
                    {new Date(wf.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Row 4: pills */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {intent && (
                    <Pill variant="violet">{intent.category}</Pill>
                  )}
                  {actions.pills.map((p, i) => (
                    <Pill key={i}>{p}</Pill>
                  ))}
                  {actions.remaining > 0 && (
                    <Pill>+{actions.remaining}</Pill>
                  )}
                  {signals.hasBranching && (
                    <Pill variant="amber">Branching</Pill>
                  )}
                  {signals.hasExternalCalls && (
                    <Pill variant="sky">External</Pill>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Intent Card ────────────────────────────────────────────────────────────

const INTENT_FIELDS: { key: keyof WorkflowIntent; label: string; multiline?: boolean }[] = [
  { key: "summary", label: "Summary" },
  { key: "problemSolved", label: "Problem Solved" },
  { key: "input", label: "Input" },
  { key: "processing", label: "Processing", multiline: true },
  { key: "output", label: "Output" },
  { key: "category", label: "Category" },
];

function IntentCard({
  intent,
  onUpdate,
  onReset,
}: {
  intent: WorkflowIntent;
  onUpdate: (next: WorkflowIntent) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(intent);
  const [copied, setCopied] = useState(false);

  // Sync draft when intent changes from outside (e.g. workflow selection change)
  const [prevIntent, setPrevIntent] = useState(intent);
  if (intent !== prevIntent) {
    setPrevIntent(intent);
    setDraft(intent);
    setEditing(false);
  }

  function handleFieldChange(key: keyof WorkflowIntent, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleTagsChange(value: string) {
    setDraft((d) => ({
      ...d,
      tags: value.split(",").map((t) => t.trim()).filter(Boolean),
    }));
  }

  function handleDone() {
    onUpdate(draft);
    setEditing(false);
  }

  function handleReset() {
    onReset();
    setEditing(false);
  }

  async function handleExport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(intent, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored in MVP
    }
  }

  return (
    <section className="rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-indigo-100 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
          Intent (Draft)
        </h3>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                {copied ? "Copied!" : "Export JSON"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-200"
              >
                Edit
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                Reset to draft
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-700"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            {INTENT_FIELDS.map(({ key, label, multiline }) => (
              <div key={key}>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {label}
                </label>
                {multiline ? (
                  <textarea
                    value={draft[key] as string}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                  />
                ) : (
                  <input
                    type="text"
                    value={draft[key] as string}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                  />
                )}
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={draft.tags.join(", ")}
                onChange={(e) => handleTagsChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
          </div>
        ) : (
          <dl className="space-y-2.5">
            {INTENT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm leading-snug text-zinc-800">
                  {intent[key] as string}
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Tags
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {intent.tags.map((tag) => (
                  <Pill key={tag} variant="indigo">
                    {tag}
                  </Pill>
                ))}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

// ─── Mini Map tiles + arrows ────────────────────────────────────────────────

function NodeTile({ node }: { node: MiniMapNode }) {
  const isTrigger =
    node.type.toLowerCase().includes("trigger") ||
    node.type.toLowerCase().includes("webhook");

  return (
    <div
      className={`flex h-14 w-32 shrink-0 flex-col items-center justify-center rounded-lg border text-center ${
        isTrigger
          ? "border-orange-200 bg-orange-50 text-orange-700"
          : "border-zinc-200 bg-white text-zinc-700"
      }`}
    >
      <span className="text-base leading-none">
        {isTrigger ? "⚡" : "⬡"}
      </span>
      <span className="mt-0.5 max-w-[7rem] truncate px-1 text-[10px] font-medium leading-tight">
        {node.label}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center px-0.5 text-zinc-300">
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
        <path
          d="M0 6h20m0 0-4-4m4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MiniWorkflowMap({ workflow }: { workflow: Workflow }) {
  const { mainPath, branches } = buildMiniMap(workflow.graph);

  if (mainPath.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-400">
        No nodes to display.
      </p>
    );
  }

  return (
    <div className="space-y-3 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex items-center">
        {mainPath.map((node, i) => (
          <div key={node.name} className="flex items-center">
            {i > 0 && <Arrow />}
            <NodeTile node={node} />
          </div>
        ))}
      </div>
      {branches.map((branch, bi) => (
        <div key={bi} className="flex items-center pl-8">
          <span className="mr-1 text-[10px] text-zinc-400">↳</span>
          {branch.map((node, i) => (
            <div key={node.name} className="flex items-center">
              {i > 0 && <Arrow />}
              <NodeTile node={node} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Detail Panel (right) ───────────────────────────────────────────────────

function DetailPanel({
  workflow,
  intent,
  onIntentUpdate,
  onIntentReset,
}: {
  workflow: Workflow | null;
  intent: WorkflowIntent | null;
  onIntentUpdate: (next: WorkflowIntent) => void;
  onIntentReset: () => void;
}) {
  if (!workflow || !intent) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <p className="text-sm text-zinc-400">
          Select a workflow to see details.
        </p>
      </div>
    );
  }

  const trigger = getTriggerSummary(workflow.graph);
  const signals = getSignals(workflow.graph);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-900">
            {workflow.name}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Updated{" "}
            {new Date(workflow.updatedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-600">
            {trigger.label}
          </p>
        </div>
        <span
          className={`ml-4 mt-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            workflow.active
              ? "bg-emerald-100 text-emerald-700"
              : "bg-zinc-100 text-zinc-400"
          }`}
        >
          {workflow.active ? "Active" : "Paused"}
        </span>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {/* ★ Intent card — top of detail */}
        <IntentCard
          intent={intent}
          onUpdate={onIntentUpdate}
          onReset={onIntentReset}
        />

        {/* Signals */}
        {(signals.hasBranching || signals.hasExternalCalls) && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Signals
            </h3>
            <div className="flex items-center gap-2">
              {signals.hasBranching && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12V4m0 0 4 4m-4-4L0 8M12 12V4" />
                  </svg>
                  Branching
                </span>
              )}
              {signals.hasExternalCalls && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M2 8h12M8 2c-2 2-2 10 0 12M8 2c2 2 2 10 0 12" />
                  </svg>
                  External Calls
                </span>
              )}
            </div>
          </section>
        )}

        {/* Mini map (visually demoted under intent) */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Workflow Preview
          </h3>
          <MiniWorkflowMap workflow={workflow} />
        </section>

        {/* Node list */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Nodes ({workflow.graph?.nodes.length ?? 0})
          </h3>
          <div className="rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {workflow.graph?.nodes.map((node, i) => (
                  <tr
                    key={node.id ?? i}
                    className="border-b border-zinc-50 last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-zinc-800">
                      {node.label}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                        {formatNodeType(node.type)}
                      </span>
                    </td>
                  </tr>
                )) ?? []}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Demo Data Button ───────────────────────────────────────────────────────

function DemoDataButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
    >
      <svg
        className="h-4 w-4 text-zinc-400"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 4h12M2 8h12M2 12h8" />
      </svg>
      Use demo data
    </button>
  );
}

// ─── Dashboard (root client component) ──────────────────────────────────────

export default function Dashboard({
  workflows,
  error,
  initialN8nConnected = false,
  initialDemoMode = false,
}: {
  workflows: Workflow[];
  error: string | null;
  initialN8nConnected?: boolean;
  initialDemoMode?: boolean;
}) {
  const router = useRouter();
  const [activeTool, setActiveTool] = useState("n8n");
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
    null
  );

  // ─── Connect n8n modal ───────────────────────────────────────
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [n8nConnected, setN8nConnected] = useState(initialN8nConnected);

  // ─── Demo mode (server env flag OR localStorage) ────────────
  const [demoActive, setDemoActive] = useState(initialDemoMode);

  // Hydrate demo state from localStorage (state-during-render pattern)
  const [localChecked, setLocalChecked] = useState(false);
  if (!localChecked && typeof window !== "undefined") {
    setLocalChecked(true);
    if (!initialDemoMode && isDemoMode()) {
      setDemoActive(true);
    }
  }

  const handleEnableDemo = useCallback(() => {
    enableDemoMode();
    setDemoActive(true);
    setSelectedWorkflow(null);
  }, []);

  const handleDisableDemo = useCallback(() => {
    disableDemoMode();
    setDemoActive(false);
    setSelectedWorkflow(null);
    router.refresh();
  }, [router]);

  const handleConnectSuccess = useCallback(() => {
    setN8nConnected(true);
    // If user connects for real, exit demo mode
    disableDemoMode();
    setDemoActive(false);
    router.refresh();
  }, [router]);

  // Resolve active workflows: demo data takes priority when demo mode is on
  const activeWorkflows = demoActive ? getAllWorkflows() : workflows;
  console.log("WORKFLOWS:", workflows);
  console.log("ACTIVE_WORKFLOWS:", activeWorkflows);
  const isConnectedOrDemo = n8nConnected || demoActive;

  // ─── Intent state ───────────────────────────────────────────
  const [intentOverrides, setIntentOverrides] = useState<
    Record<string, WorkflowIntent>
  >({});

  const draftIntents = useMemo(() => {
    const map: Record<string, WorkflowIntent> = {};
    for (const wf of activeWorkflows) {
      map[wf.id] = generateDraftIntent(wf);
    }
    return map;
  }, [activeWorkflows]);

  const intents = useMemo(() => {
    const map: Record<string, WorkflowIntent> = {};
    for (const wf of activeWorkflows) {
      map[wf.id] = intentOverrides[wf.id] ?? draftIntents[wf.id];
    }
    return map;
  }, [activeWorkflows, draftIntents, intentOverrides]);

  const handleIntentUpdate = useCallback(
    (next: WorkflowIntent) => {
      if (!selectedWorkflow) return;
      setIntentOverrides((prev) => ({ ...prev, [selectedWorkflow.id]: next }));
    },
    [selectedWorkflow]
  );

  const handleIntentReset = useCallback(() => {
    if (!selectedWorkflow) return;
    setIntentOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedWorkflow.id];
      return next;
    });
  }, [selectedWorkflow]);

  const currentIntent = selectedWorkflow
    ? intents[selectedWorkflow.id] ?? null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <ToolSidebar
        selected={activeTool}
        onSelect={setActiveTool}
        onConnectN8n={() => setConnectModalOpen(true)}
        n8nConnected={n8nConnected}
        isDemo={demoActive}
        onDisableDemo={handleDisableDemo}
      />
      <ConnectProviderModal
        open={connectModalOpen}
        provider="n8n"
        onClose={() => setConnectModalOpen(false)}
        onSuccess={handleConnectSuccess}
      />

      {/* Empty state: not connected and not in demo mode */}
      {!isConnectedOrDemo ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
              ⚡
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Connect n8n to get started
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Click the{" "}
              <span className="font-medium text-indigo-600">+</span> next to
              n8n in the sidebar to connect your instance.
            </p>
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Connect n8n
            </button>

            <div className="mt-6 border-t border-zinc-100 pt-5">
              <p className="text-xs text-zinc-400">
                No n8n connection? Continue with sample data.
              </p>
              <DemoDataButton onClick={handleEnableDemo} />
            </div>
          </div>
        </div>
      ) : /* Error state: connected but API failed — also offer demo fallback */
      error && !demoActive ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-600">
              {error}
            </div>
            <div className="mt-5">
              <p className="text-xs text-zinc-400">
                Connection issue? Try demo data instead.
              </p>
              <DemoDataButton onClick={handleEnableDemo} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <WorkflowListPanel
            workflows={activeWorkflows}
            selectedId={selectedWorkflow?.id ?? null}
            onSelect={setSelectedWorkflow}
            intents={intents}
            isConnected={isConnectedOrDemo}
          />
          <DetailPanel
            workflow={selectedWorkflow}
            intent={currentIntent}
            onIntentUpdate={handleIntentUpdate}
            onIntentReset={handleIntentReset}
          />
        </>
      )}
    </div>
  );
}
