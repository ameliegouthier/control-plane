"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  deriveProvidersFromWorkflows,
  type WorkflowLike,
} from "@/lib/provider-filter";

const STORAGE_KEY = "dashboard-provider-filters";

function loadFromSessionStorage(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveToSessionStorage(providers: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
  } catch {
    // ignore
  }
}

export type ProviderFilterMode = "dashboard" | "workflow";

interface ProviderFilterContextValue {
  /** Unique providers derived from workflows (never hardcoded). */
  providers: string[];
  /** Currently selected providers. All selected = show all workflows. */
  selectedProviders: string[];
  /** Toggle a provider on/off. */
  toggleProvider: (provider: string) => void;
  /** Check if a provider is selected. */
  isSelected: (provider: string) => boolean;
  /** Register workflows (called by pages when they mount). Derives providers. */
  setWorkflows: (workflows: WorkflowLike[]) => void;
  /** Merge workflows into existing list (e.g. when opening detail, keep overview providers). */
  mergeWorkflows: (workflows: WorkflowLike[]) => void;
  /** Filter workflows by selected providers. */
  filterByProviders: <T extends WorkflowLike>(workflows: T[]) => T[];
  /** Set mode - used internally by useProviderFilter. */
  setMode: (mode: ProviderFilterMode, workflowProvider?: string) => void;
}

const ProviderFilterContext = createContext<ProviderFilterContextValue | null>(
  null
);

export function ProviderFilterProvider({
  children,
  initialProvidersFromIntegrations = [],
}: {
  children: React.ReactNode;
  /**
   * Unique providers loaded from the integrations table on the server.
   * This ensures the sidebar always shows all connected providers,
   * even when a page is loaded directly (e.g. workflow detail).
   */
  initialProvidersFromIntegrations?: string[];
}) {
  const [workflows, setWorkflowsState] = useState<WorkflowLike[]>([]);
  const [mode, setModeState] = useState<ProviderFilterMode>("dashboard");
  const [workflowProvider, setWorkflowProviderState] = useState<string | undefined>();
  const [dashboardSelectedProviders, setDashboardSelectedProviders] = useState<string[]>([]);
  const [workflowLocalSelected, setWorkflowLocalSelected] = useState<string[]>([]);

  const integrationProviders = useMemo(
    () =>
      Array.from(
        new Set(
          (initialProvidersFromIntegrations ?? []).map((p) =>
            typeof p === "string" ? p.toLowerCase() : p,
          ),
        ),
      ),
    [initialProvidersFromIntegrations],
  );

  const providers = useMemo(() => {
    const fromWorkflows = deriveProvidersFromWorkflows(workflows);
    if (integrationProviders.length === 0) {
      return fromWorkflows;
    }
    // Use integrations as the primary source, but include any additional
    // providers that appear only in workflows (e.g. demo mode).
    return Array.from(
      new Set([...integrationProviders, ...fromWorkflows.map((p) => p.toLowerCase())]),
    );
  }, [workflows, integrationProviders]);

  const selectedProviders =
    mode === "workflow" && workflowProvider
      ? workflowLocalSelected
      : dashboardSelectedProviders;

  const setMode = useCallback((nextMode: ProviderFilterMode, nextWorkflowProvider?: string) => {
    setModeState(nextMode);
    if (nextMode === "workflow" && nextWorkflowProvider) {
      setWorkflowProviderState(nextWorkflowProvider);
      setWorkflowLocalSelected([nextWorkflowProvider]);
    } else {
      setWorkflowProviderState(undefined);
      setWorkflowLocalSelected([]);
      // Restore dashboard state from sessionStorage
      const stored = loadFromSessionStorage();
      if (stored && stored.length > 0) {
        setDashboardSelectedProviders(stored);
      }
    }
  }, []);

  const setWorkflows = useCallback((next: WorkflowLike[]) => {
    const nextProviders = deriveProvidersFromWorkflows(next);
    setWorkflowsState(next);
    // setWorkflows is only called from dashboard pages - always restore/update dashboard state
    setDashboardSelectedProviders((sel) => {
      if (nextProviders.length === 0) return [];
      const stored = loadFromSessionStorage();
      if (stored && stored.length > 0) {
        const valid = stored.filter((p) => nextProviders.includes(p));
        if (valid.length > 0) return valid;
      }
      if (sel.length === 0) return nextProviders;
      return sel.filter((p) => nextProviders.includes(p));
    });
  }, []);

  const toggleProvider = useCallback((provider: string) => {
    if (mode === "dashboard") {
      setDashboardSelectedProviders((prev) => {
        const next = prev.includes(provider)
          ? prev.filter((p) => p !== provider)
          : [...prev, provider];
        saveToSessionStorage(next);
        return next;
      });
    } else {
      setWorkflowLocalSelected((prev) =>
        prev.includes(provider)
          ? prev.filter((p) => p !== provider)
          : [...prev, provider]
      );
    }
  }, [mode]);

  const isSelected = useCallback(
    (provider: string) => selectedProviders.includes(provider),
    [selectedProviders]
  );

  // Persist dashboard filters when they change
  useEffect(() => {
    if (mode === "dashboard" && dashboardSelectedProviders.length > 0) {
      saveToSessionStorage(dashboardSelectedProviders);
    }
  }, [mode, dashboardSelectedProviders]);

  const mergeWorkflows = useCallback((next: WorkflowLike[]) => {
    setWorkflowsState((prev) => {
      const byId = new Map(prev.map((w) => [(w as { id?: string }).id ?? w.provider, w]));
      for (const w of next) {
        const id = (w as { id?: string }).id ?? w.provider;
        byId.set(id, w);
      }
      return Array.from(byId.values());
    });
  }, []);

  const filterByProviders = useCallback(
    <T extends WorkflowLike>(items: T[]): T[] => {
      if (selectedProviders.length === 0) return [];
      const allSelected = providers.length > 0 && providers.every((p) => selectedProviders.includes(p));
      if (allSelected) return items;
      return items.filter((w) => selectedProviders.includes(w.provider));
    },
    [selectedProviders, providers]
  );

  const value = useMemo<ProviderFilterContextValue>(
    () => ({
      providers,
      selectedProviders,
      toggleProvider,
      isSelected,
      setWorkflows,
      mergeWorkflows,
      filterByProviders,
      setMode,
    }),
    [
      providers,
      selectedProviders,
      toggleProvider,
      isSelected,
      setWorkflows,
      mergeWorkflows,
      filterByProviders,
      setMode,
    ]
  );

  return (
    <ProviderFilterContext.Provider value={value}>
      {children}
    </ProviderFilterContext.Provider>
  );
}

export function useProviderFilterContext(): ProviderFilterContextValue {
  const ctx = useContext(ProviderFilterContext);
  if (!ctx) {
    throw new Error("useProviderFilter must be used within ProviderFilterProvider");
  }
  return ctx;
}
