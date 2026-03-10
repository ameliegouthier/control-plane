/**
 * Workflow Helpers Tests
 * 
 * Validates toWorkflow() backward compatibility and graph normalization.
 */

import { describe, it, expect } from "vitest";
import { toWorkflow } from "../workflow-helpers";
import type { Workflow as DbWorkflow, Integration } from "@prisma/client";

describe("workflow-helpers.toWorkflow()", () => {
  const defaultIntegration: Integration = {
    id: "int-1",
    userId: "user-1",
    provider: "n8n",
    name: "n8n",
    status: "ACTIVE",
    externalAccountId: null,
    config: {},
    credentials: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createDbWorkflow(
    overrides: Partial<DbWorkflow & { integration?: Integration | null }> = {}
  ): DbWorkflow & { integration?: Integration | null } {
    return {
      id: "wf-1",
      userId: "user-1",
      integrationId: "int-1",
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      config: {
        provider: "n8n",
        externalId: "external-123",
        actions: { graph: { nodes: [], edges: [] } },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      integration: defaultIntegration,
      ...overrides,
    } as DbWorkflow & { integration?: Integration | null };
  }

  describe("Provider field handling", () => {
    it("should use config.provider when present", () => {
      const db = createDbWorkflow({
        config: { provider: "make", externalId: "e1", actions: {} },
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("make");
    });

    it("should fall back to integration.provider when config.provider missing", () => {
      const db = createDbWorkflow({
        config: { externalId: "e1", actions: {} },
        integration: { ...defaultIntegration, provider: "make" },
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("make");
    });

    it("should default to n8n when provider missing and integration missing", () => {
      const db = createDbWorkflow({
        config: { externalId: "e1", actions: {} },
        integration: undefined,
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("n8n");
    });

    it("should use integration.provider when config has invalid provider", () => {
      const db = createDbWorkflow({
        config: { provider: "invalid", externalId: "e1", actions: {} },
        integration: { ...defaultIntegration, provider: "zapier" },
      });
      const result = toWorkflow(db);

      expect(result.provider).toBe("zapier");
    });
  });

  describe("External ID handling", () => {
    it("should use config.externalId when present", () => {
      const db = createDbWorkflow({
        config: { provider: "n8n", externalId: "new-external-456", actions: {} },
      });
      const result = toWorkflow(db);

      expect(result.id).toBe("new-external-456");
    });

    it("should fall back to db.id when config.externalId missing", () => {
      const db = createDbWorkflow({
        config: { provider: "n8n", actions: {} },
      });
      const result = toWorkflow(db);

      expect(result.id).toBe("wf-1");
    });
  });

  describe("Graph normalization", () => {
    it("should parse new graph format", () => {
      const db = createDbWorkflow({
        config: {
          provider: "n8n",
          externalId: "e1",
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
        config: {
          provider: "n8n",
          externalId: "e1",
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
        config: { provider: "n8n", externalId: "e1", actions: { graph: { nodes: [], edges: [] } } },
      });
      const result = toWorkflow(db);

      expect(result.graph).toBeDefined();
      expect(result.graph?.nodes).toHaveLength(0);
    });

    it("should handle missing actions gracefully", () => {
      const db = createDbWorkflow({
        config: null,
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
        config: { provider: "make", externalId: "make-wf-999", actions: {} },
        updatedAt: new Date("2024-01-15"),
        createdAt: new Date("2024-01-01"),
      });
      const result = toWorkflow(db);

      expect(result.name).toBe("My Workflow");
      expect(result.active).toBe(false);
      expect(result.provider).toBe("make");
      expect(result.id).toBe("make-wf-999");
      expect(result.connectionId).toBe("int-1");
      expect(result.updatedAt).toBe(db.updatedAt.toISOString());
      expect(result.createdAt).toBe(db.createdAt.toISOString());
    });
  });
});
