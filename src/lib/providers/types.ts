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
 * id is the canonical DB id (used in routes); externalId is the provider workflow id (metadata only).
 */
export interface WorkflowCore {
  id: string;
  /** Provider workflow id (n8n scenario id, Make scenario id). Used as metadata only; never for routing. */
  externalId?: string;
  name: string;
  active: boolean;
  provider: AutomationProvider;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
  /** AI-generated one-sentence summary of what the workflow does. Null until generated. */
  aiSummary?: string | null;
}

/** Category for normalized nodes (trigger, read, write, notify, ai, transform). */
export type NodeCategory = "trigger" | "read" | "write" | "notify" | "ai" | "transform";

/**
 * Metadata attached to nodes that originate from an AI agent's tool flow.
 * Preserves the agent–tool relationship after flattening without altering
 * node id, type, or edge logic.
 */
export interface AgentToolMeta {
  isAgentTool: true;
  parentAgentId: string;
  toolName: string;
}

/**
 * Provider-agnostic graph node representation.
 * Normalized from provider-specific node formats.
 * Optional resource fields for nodes that interact with external services (Notion, Slack, etc.).
 */
export interface WorkflowGraphNode {
  id: string;
  label: string; // Human-readable name
  kind: "trigger" | "action" | "router" | "other";
  type: string; // Provider-specific type (may contain prefixes like "n8n-nodes-base.webhook")
  /** Provider that produced this node (n8n or make). */
  provider?: "n8n" | "make";
  /** Normalized service name for grouping (e.g. "slack", "google-sheets"). */
  service?: string;
  /** Operation/action name (e.g. "CreateMessage", "createDatabaseItem", or inferred for n8n). */
  operation?: string;
  /** @deprecated Use operation instead. Kept for backward compatibility. */
  action?: string;
  /** Category: trigger, read, write, notify, ai, transform. */
  category?: NodeCategory;
  /** Notion database ID (when type contains "notion"). */
  databaseId?: string;
  /** Slack channel ID or channel name (when type contains "slack"), from parameters.channel. */
  channelId?: string;
  /** Present when this node was extracted from an AI agent's tool flow. */
  meta?: AgentToolMeta;
  /** AI-generated description of what this node does. Null until generated. */
  aiSummary?: string | null;
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
