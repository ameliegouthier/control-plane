/**
 * Provider filter utilities for the sidebar.
 * Providers are derived dynamically from workflows (never hardcoded).
 */

export type WorkflowLike = { provider: string };

/**
 * Derive unique provider list from workflows.
 * Used to populate sidebar icons dynamically.
 */
export function deriveProvidersFromWorkflows(
  workflows: WorkflowLike[]
): string[] {
  return Array.from(
    new Set((workflows ?? []).map((w) => w.provider).filter(Boolean))
  );
}
