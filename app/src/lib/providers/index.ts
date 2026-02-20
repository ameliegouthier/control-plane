/**
 * Provider adapter registry and factory.
 *
 * Central entry point for accessing provider adapters.
 */

import { N8NAdapter } from "./n8n-adapter";
import { MakeAdapter } from "./make-adapter";
import type { ProviderAdapter, AutomationProvider } from "./types";

// ─── Adapter Registry ──────────────────────────────────────────────────────────

const adapters: Map<AutomationProvider, ProviderAdapter> = new Map([
  ["n8n", new N8NAdapter()],
  ["make", new MakeAdapter()],
]);

/**
 * Get the adapter for a specific provider.
 */
export function getProviderAdapter(provider: AutomationProvider): ProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${provider}`);
  }
  return adapter;
}

/**
 * Get all registered providers.
 */
export function getRegisteredProviders(): AutomationProvider[] {
  return Array.from(adapters.keys());
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export * from "./types";
export { N8NAdapter } from "./n8n-adapter";
export { MakeAdapter } from "./make-adapter";
