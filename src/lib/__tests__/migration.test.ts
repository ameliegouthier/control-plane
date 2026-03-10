/**
 * Migration Logic Tests
 *
 * Validates that workflows work with Integration model and config-based provider/externalId.
 */

import { describe, it, expect } from "vitest";
import type { Workflow as DbWorkflow, Integration } from "@prisma/client";
import { toWorkflow } from "@/app/workflow-helpers";

describe("Migration Logic", () => {
  function createLegacyWorkflow(
    externalIdOrToolWorkflowId: string,
    provider: string,
    integrationId: string
  ): DbWorkflow & { integration?: Integration | null } {
    return {
      id: "wf-1",
      userId: "user-1",
      integrationId,
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      config: { actions: { nodes: [], connections: {} }, externalId: externalIdOrToolWorkflowId },
      createdAt: new Date(),
      updatedAt: new Date(),
      integration: {
        id: integrationId,
        userId: "user-1",
        provider,
        name: provider,
        status: "ACTIVE",
        externalAccountId: null,
        config: {},
        credentials: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as DbWorkflow & { integration?: Integration | null };
  }

  function createNewWorkflow(
    provider: string,
    externalId: string,
    integrationId: string
  ): DbWorkflow & { integration?: Integration | null } {
    return {
      id: "wf-2",
      userId: "user-1",
      integrationId,
      name: "New Workflow",
      status: "active",
      triggerType: null,
      config: { provider, externalId, actions: { graph: { nodes: [], edges: [] } } },
      createdAt: new Date(),
      updatedAt: new Date(),
      integration: {
        id: integrationId,
        userId: "user-1",
        provider,
        name: provider,
        status: "ACTIVE",
        externalAccountId: null,
        config: {},
        credentials: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as DbWorkflow & { integration?: Integration | null };
  }

  describe("toWorkflow() backward compatibility", () => {
    it("should derive provider from integration for legacy workflows (n8n)", () => {
      const legacy = createLegacyWorkflow("n8n-wf-123", "n8n", "int-1");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("n8n-wf-123");
    });

    it("should derive provider from integration for legacy workflows (make)", () => {
      const legacy = createLegacyWorkflow("make-wf-456", "make", "int-2");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("make");
      expect(result.id).toBe("make-wf-456");
    });

    it("should derive provider from integration for legacy workflows (zapier)", () => {
      const legacy = createLegacyWorkflow("zapier-wf-789", "zapier", "int-3");
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("zapier");
      expect(result.id).toBe("zapier-wf-789");
    });

    it("should use config.provider when present (new world)", () => {
      const newWf = createNewWorkflow("n8n", "n8n-wf-999", "int-1");
      const result = toWorkflow(newWf);

      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("n8n-wf-999");
    });

    it("should use config.externalId when present", () => {
      const newWf = createNewWorkflow("make", "make-external-123", "int-2");
      const result = toWorkflow(newWf);

      expect(result.id).toBe("make-external-123");
    });

    it("should handle missing integration gracefully", () => {
      const legacy = createLegacyWorkflow("wf-123", "n8n", "int-1");
      legacy.integration = null;
      const result = toWorkflow(legacy);

      expect(result.provider).toBe("n8n");
      expect(result.id).toBe("wf-123");
    });

    it("should handle invalid provider string gracefully", () => {
      const invalid = createNewWorkflow("invalid-provider", "wf-123", "int-1");
      const result = toWorkflow(invalid);

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
