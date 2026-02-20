/**
 * Provider abstraction layer for multi-provider automation governance.
 *
 * This module defines the core types and interfaces for supporting multiple
 * automation providers (n8n, Make, Zapier, etc.) in a unified way.
 */

// ─── Provider Types ────────────────────────────────────────────────────────────

export type AutomationProvider = "n8n" | "make" | "zapier" | "airtable";

export interface ProviderConnection {
  id: string;
  provider: AutomationProvider;
  userId: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  config: Record<string, unknown>;
  lastSyncedAt?: Date | null;
}

// ─── Generic Workflow Model ────────────────────────────────────────────────────

/**
 * Core workflow metadata - provider-agnostic.
 * Contains only essential workflow identification and status information.
 */
export interface WorkflowCore {
  id: string;
  name: string;
  active: boolean;
  provider: AutomationProvider;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Provider-agnostic graph node representation.
 * Normalized from provider-specific node formats.
 */
export interface WorkflowGraphNode {
  id: string;
  label: string; // Human-readable name
  kind: "trigger" | "action" | "router" | "other";
  type: string; // Provider-specific type (may contain prefixes like "n8n-nodes-base.webhook")
}

/**
 * Provider-agnostic graph edge representation.
 * Represents connections between nodes in a normalized format.
 */
export interface WorkflowGraphEdge {
  from: string; // Source node ID
  to: string; // Target node ID
}

/**
 * Normalized workflow graph structure.
 * Provider-agnostic representation of workflow structure.
 */
export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

/**
 * Complete Workflow model - provider-agnostic.
 * Combines core metadata with optional normalized graph structure.
 */
export interface Workflow extends WorkflowCore {
  graph?: WorkflowGraph;
}

// ─── Legacy Types (for backward compatibility during migration) ────────────────

/**
 * @deprecated Use WorkflowGraphNode instead
 * Legacy node type kept for migration purposes.
 */
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
}

/**
 * @deprecated Use WorkflowGraphEdge[] instead
 * Legacy connections type kept for migration purposes.
 */
export interface WorkflowConnections {
  [sourceNodeName: string]: {
    main: Array<Array<{
      node: string;
      type: string;
      index: number;
    }>>;
  };
}

// ─── Provider Adapter Interface ────────────────────────────────────────────────

/**
 * Raw workflow data from a provider API.
 * Each adapter defines its own RawProviderWorkflow type based on the provider's API format.
 */
export type RawProviderWorkflow = unknown;

/**
 * Result of fetching workflows from a provider.
 */
export interface FetchWorkflowsResult {
  success: boolean;
  workflows: RawProviderWorkflow[];
  error?: string;
}

/**
 * Result of syncing workflows to the database.
 */
export interface SyncWorkflowsResult {
  success: boolean;
  synced: number;
  error?: string;
}

/**
 * Provider adapter interface.
 * Each provider (n8n, Make, etc.) implements this interface to:
 * 1. Fetch workflows from their API
 * 2. Normalize them into the generic Workflow model
 * 3. Sync them to the database
 */
export interface ProviderAdapter {
  /**
   * The provider this adapter handles.
   */
  readonly provider: AutomationProvider;

  /**
   * Fetch raw workflows from the provider's API.
   */
  fetchWorkflows(
    connection: ProviderConnection
  ): Promise<FetchWorkflowsResult>;

  /**
   * Normalize a raw provider workflow into the generic Workflow model.
   */
  normalizeWorkflow(
    raw: RawProviderWorkflow,
    connectionId: string
  ): Workflow | null;

  /**
   * Sync workflows from the provider to the database.
   * This combines fetch + normalize + database sync.
   */
  syncWorkflows(connection: ProviderConnection): Promise<SyncWorkflowsResult>;
}
