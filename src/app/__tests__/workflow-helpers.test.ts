/**
 * Workflow Helpers Tests
 * 
 * Validates toWorkflow() backward compatibility and graph normalization.
 */

import { describe, it, expect } from "vitest";
import { toWorkflow } from "../workflow-helpers";
import type { Workflow as DbWorkflow, Connection, ToolType } from "@prisma/client";

describe("workflow-helpers.toWorkflow()", () => {
  // Helper to create test workflows
  function createDbWorkflow(
    overrides: Partial<DbWorkflow & { connection: Connection | null }> = {}
  ): DbWorkflow & { connection: Connection | null } {
    return {
      id: "wf-1",
      userId: "user-1",
      connectionId: "conn-1",
      toolWorkflowId: "external-123",
      provider: "n8n" as any,
      externalId: "external-123",
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      triggerConfig: null,
      actions: { graph: { nodes: [], edges: [] } },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: null,
      connection: {
        id: "conn-1",
        userId: "user-1",
        tool: "N8N" as ToolType,
        status: "ACTIVE",
        externalAccountId: null,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: null,
      },
      ...overrides,
    };
  }

  describe("Provider field handling", () => {
    it("should use workflow.provider when present (new world)", () => {
      const db = createDbWorkflow({ provider: "make" as any });
      const result = toWorkflow(db);

      expect(result.provider).toBe("make");
    });

    it("should fall back to connection.tool when provider missing (legacy)", () => {
      const db = createDbWorkflow({
        provider: undefined as any,
        connection: {
          id: "conn-1",
          userId: "user-1",
          tool: "MAKE" as ToolType,
          status: "ACTIVE",
          externalAccountId: null,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncedAt: null,
        },
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("make");
    });

    it("should default to n8n when provider missing and connection missing", () => {
      const db = createDbWorkflow({
        provider: undefined as any,
        connection: null,
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("n8n");
    });

    it("should reject invalid provider strings and fall back", () => {
      const db = createDbWorkflow({
        provider: "invalid-provider" as any,
        connection: {
          id: "conn-1",
          userId: "user-1",
          tool: "ZAPIER" as ToolType,
          status: "ACTIVE",
          externalAccountId: null,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncedAt: null,
        },
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("zapier"); // Falls back to connection.tool
    });
  });

  describe("External ID handling", () => {
    it("should use externalId when present (new world)", () => {
      const db = createDbWorkflow({
        externalId: "new-external-456",
        toolWorkflowId: "legacy-123",
      });
      const result = toWorkflow(db);

      expect(result.id).toBe("new-external-456");
    });

    it("should fall back to toolWorkflowId when externalId missing (legacy)", () => {
      const db = createDbWorkflow({
        externalId: undefined as any,
        toolWorkflowId: "legacy-789",
      });
      const result = toWorkflow(db);

      expect(result.id).toBe("legacy-789");
    });
  });

  describe("Graph normalization", () => {
    it("should parse new graph format", () => {
      const db = createDbWorkflow({
        actions: {
          graph: {
            nodes: [
              {
                id: "node-1",
                label: "Webhook",
                kind: "trigger",
                type: "n8n-nodes-base.webhook",
              },
            ],
            edges: [],
          },
        },
      });
      const result = toWorkflow(db);

      expect(result.graph).toBeDefined();
      expect(result.graph?.nodes).toHaveLength(1);
      expect(result.graph?.nodes[0].label).toBe("Webhook");
      expect(result.graph?.nodes[0].kind).toBe("trigger");
    });

    it("should convert legacy nodes/connections format", () => {
      const db = createDbWorkflow({
        actions: {
          nodes: [
            {
              id: "node-1",
              name: "HTTP Request",
              type: "n8n-nodes-base.httpRequest",
            },
          ],
          connections: {
            "node-1": {
              main: [[{ node: "node-2", type: "main", index: 0 }]],
            },
          },
        },
      });
      const result = toWorkflow(db);

      expect(result.graph).toBeDefined();
      expect(result.graph?.nodes).toHaveLength(1);
      expect(result.graph?.nodes[0].label).toBe("HTTP Request");
      expect(result.graph?.edges).toHaveLength(1);
      expect(result.graph?.edges[0].from).toBe("node-1");
      expect(result.graph?.edges[0].to).toBe("node-2");
    });

    it("should handle empty graph gracefully", () => {
      const db = createDbWorkflow({
        actions: { graph: { nodes: [], edges: [] } },
      });
      const result = toWorkflow(db);

      expect(result.graph).toBeDefined();
      expect(result.graph?.nodes).toHaveLength(0);
    });

    it("should handle missing actions gracefully", () => {
      const db = createDbWorkflow({
        actions: null,
      });
      const result = toWorkflow(db);

      expect(result.graph).toBeUndefined();
    });
  });

  describe("Complete workflow mapping", () => {
    it("should map all required fields correctly", () => {
      const db = createDbWorkflow({
        name: "My Workflow",
        status: "inactive",
        provider: "make" as any,
        externalId: "make-wf-999",
        updatedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-01"),
      });
      const result = toWorkflow(db);

      expect(result.name).toBe("My Workflow");
      expect(result.active).toBe(false);
      expect(result.provider).toBe("make");
      expect(result.id).toBe("make-wf-999");
      expect(result.connectionId).toBe("conn-1");
      expect(result.updatedAt).toBe(db.updatedAt.toISOString());
      expect(result.createdAt).toBe(db.createdAt.toISOString());
    });
  });
});
