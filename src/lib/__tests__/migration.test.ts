/**
 * Migration Logic Tests
 * 
 * Validates that workflows created pre-migration are correctly populated
 * with provider and externalId from Connection.tool and toolWorkflowId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Workflow as DbWorkflow, Connection, ToolType } from "@prisma/client";
import { toWorkflow } from "@/app/workflow-helpers";

describe("Migration Logic", () => {
  // Helper to create a legacy workflow (pre-migration)
  function createLegacyWorkflow(
    toolWorkflowId: string,
    tool: ToolType,
    connectionId: string
  ): DbWorkflow & { connection: Connection | null } {
    return {
      id: "wf-1",
      userId: "user-1",
      connectionId,
      toolWorkflowId,
      // Legacy: no provider or externalId
      provider: undefined as any,
      externalId: undefined as any,
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      triggerConfig: null,
      actions: { nodes: [], connections: {} },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      connection: {
        id: connectionId,
        userId: "user-1",
        tool,
        status: "ACTIVE",
        externalAccountId: null,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
      },
    };
  }

  // Helper to create a new workflow (post-migration)
  function createNewWorkflow(
    provider: string,
    externalId: string,
    tool: ToolType,
    connectionId: string
  ): DbWorkflow & { connection: Connection | null } {
    return {
      id: "wf-2",
      userId: "user-1",
      connectionId,
      provider,
      externalId,
      toolWorkflowId: externalId, // Still present for backward compat
      name: "New Workflow",
      status: "active",
      triggerType: null,
      triggerConfig: null,
      actions: { graph: { nodes: [], edges: [] } },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      connection: {
        id: connectionId,
        userId: "user-1",
        tool,
        status: "ACTIVE",
        externalAccountId: null,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
      },
    };
  }

  describe("toWorkflow() backward compatibility", () => {
    it("should derive provider from Connection.tool for legacy workflows (N8N)", () => {
      const legacy = createLegacyWorkflow("n8n-wf-123", "N8N", "conn-1");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("n8n-wf-123"); // Uses toolWorkflowId as fallback
    });

    it("should derive provider from Connection.tool for legacy workflows (MAKE)", () => {
      const legacy = createLegacyWorkflow("make-wf-456", "MAKE", "conn-2");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("make");
      expect(result.id).toBe("make-wf-456");
    });

    it("should derive provider from Connection.tool for legacy workflows (ZAPIER)", () => {
      const legacy = createLegacyWorkflow("zapier-wf-789", "ZAPIER", "conn-3");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("zapier");
      expect(result.id).toBe("zapier-wf-789");
    });

    it("should use provider field directly when present (new world)", () => {
      const newWf = createNewWorkflow("n8n", "n8n-wf-999", "N8N", "conn-1");
      const result = toWorkflow(newWf);

      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("n8n-wf-999"); // Uses externalId
    });

    it("should use externalId when present, fallback to toolWorkflowId", () => {
      const newWf = createNewWorkflow("make", "make-external-123", "MAKE", "conn-2");
      const result = toWorkflow(newWf);

      expect(result.id).toBe("make-external-123"); // externalId preferred
    });

    it("should handle missing connection gracefully", () => {
      const legacy = createLegacyWorkflow("wf-123", "N8N", "conn-1");
      legacy.connection = null; // Missing connection
      const result = toWorkflow(legacy);

      // Should default to n8n when connection is missing
      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("wf-123");
    });

    it("should handle invalid provider string gracefully", () => {
      const invalid = createNewWorkflow("invalid-provider", "wf-123", "N8N", "conn-1");
      const result = toWorkflow(invalid);

      // Should fall back to connection.tool when provider is invalid
      expect(result.provider).toBe("n8n");
    });
  });

  describe("Migration SQL logic simulation", () => {
    it("should map ToolType.N8N to provider 'n8n'", () => {
      const legacy = createLegacyWorkflow("wf-1", "N8N", "conn-1");
      const result = toWorkflow(legacy);
      expect(result.provider).toBe("n8n");
    });

    it("should map ToolType.MAKE to provider 'make'", () => {
      const legacy = createLegacyWorkflow("wf-1", "MAKE", "conn-1");
      const result = toWorkflow(legacy);
      expect(result.provider).toBe("make");
    });

    it("should map ToolType.ZAPIER to provider 'zapier'", () => {
      const legacy = createLegacyWorkflow("wf-1", "ZAPIER", "conn-1");
      const result = toWorkflow(legacy);
      expect(result.provider).toBe("zapier");
    });
  });
});
