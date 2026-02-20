"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getWorkflowById } from "@/lib/repositories/workflowsRepository";
import {
  type Workflow,
  type MiniMapNode,
  getTriggerSummary,
  getSignals,
  formatNodeType,
  buildMiniMap,
} from "../../workflow-helpers";
import {
  type WorkflowIntent,
  generateDraftIntent,
} from "@/lib/intent";

// ─── Reusable Pill Component ──────────────────────────────────────────────────

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

// ─── Intent Card ───────────────────────────────────────────────────────────────

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

  // Sync draft when intent changes from outside
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

// ─── Mini Map Components ──────────────────────────────────────────────────────

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

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  workflow,
  intent,
  onIntentUpdate,
  onIntentReset,
}: {
  workflow: Workflow;
  intent: WorkflowIntent;
  onIntentUpdate: (next: WorkflowIntent) => void;
  onIntentReset: () => void;
}) {
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;

  // Find workflow from repository
  const workflow = useMemo(() => {
    return getWorkflowById(workflowId);
  }, [workflowId]);

  // Generate intent
  const draftIntent = useMemo(() => {
    if (!workflow) return null;
    return generateDraftIntent(workflow);
  }, [workflow]);

  // Intent state management
  const [intentOverrides, setIntentOverrides] = useState<
    Record<string, WorkflowIntent>
  >({});

  const intent = useMemo(() => {
    if (!draftIntent) return null;
    return intentOverrides[workflowId] ?? draftIntent;
  }, [draftIntent, intentOverrides, workflowId]);

  const handleIntentUpdate = useCallback(
    (next: WorkflowIntent) => {
      setIntentOverrides((prev) => ({ ...prev, [workflowId]: next }));
    },
    [workflowId]
  );

  const handleIntentReset = useCallback(() => {
    setIntentOverrides((prev) => {
      const next = { ...prev };
      delete next[workflowId];
      return next;
    });
  }, [workflowId]);

  // Not found state
  if (!workflow || !intent) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-900">
            Workflow not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            The workflow with ID "{workflowId}" could not be found.
          </p>
          <Link
            href="/overview"
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
      <DetailPanel
        workflow={workflow}
        intent={intent}
        onIntentUpdate={handleIntentUpdate}
        onIntentReset={handleIntentReset}
      />
    </div>
  );
}
