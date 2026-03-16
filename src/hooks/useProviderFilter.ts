/**
 * Reusable hook for provider filtering.
 * Must be used within ProviderFilterProvider.
 *
 * @example
 * // Dashboard mode (default): restore/persist filters from sessionStorage
 * const { providers, selectedProviders, toggleProvider, isSelected } = useProviderFilter({ mode: "dashboard" });
 *
 * @example
 * // Workflow mode: temporary local state, never persists
 * const { providers, selectedProviders, toggleProvider, isSelected } = useProviderFilter({
 *   mode: "workflow",
 *   workflowProvider: workflow.provider,
 * });
 */

import { useEffect } from "react";
import { useProviderFilterContext } from "@/contexts/ProviderFilterContext";

export type UseProviderFilterOptions = {
  mode?: "dashboard" | "workflow";
  workflowProvider?: string;
};

export function useProviderFilter(options?: UseProviderFilterOptions) {
  const ctx = useProviderFilterContext();
  const { mode = "dashboard", workflowProvider } = options ?? {};

  useEffect(() => {
    if (mode === "workflow" && workflowProvider) {
      ctx.setMode("workflow", workflowProvider);
    } else if (mode === "dashboard") {
      ctx.setMode("dashboard");
    }
  }, [mode, workflowProvider, ctx.setMode]);

  return ctx;
}
