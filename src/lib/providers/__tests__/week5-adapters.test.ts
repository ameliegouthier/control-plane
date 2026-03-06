/**
 * Week 5 Adapter Invariants Tests
 * 
 * Validates adapter behavior:
 * - n8n adapter writes provider + externalId
 * - Adapter prioritizes (provider, externalId), falls back to legacy
 * - Make adapter exists and compiles
 * - Normalization produces provider-agnostic Workflow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { N8NAdapter } from "../n8n-adapter";
import { MakeAdapter } from "../make-adapter";
import type { ProviderConnection } from "../types";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflow: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    connection: {
      update: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}));

// Mock n8n client
vi.mock("@/lib/n8n-client", () => ({
  fetchN8nApi: vi.fn(),
}));

import { prisma } from "@/lib/prisma";

describe("Week 5 Adapter Invariants", () => {
  let n8nAdapter: N8NAdapter;
  let makeAdapter: MakeAdapter;
  let connection: ProviderConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    n8nAdapter = new N8NAdapter();
    makeAdapter = new MakeAdapter();
    connection = {
      id: "conn-1",
      provider: "n8n",
      userId: "user-1",
      status: "ACTIVE",
      config: { baseUrl: "https://n8n.example.com", apiPath: "/rest" },
    };
  });

  describe("n8n adapter writes provider + externalId", () => {
    it("should set provider and externalId when creating workflow", async () => {
      const mockWorkflow = {
        id: "n8n-wf-123",
        name: "Test Workflow",
        active: true,
        nodes: [],
        connections: {},
      };

      (prisma.workflow.findUnique as any).mockResolvedValue(null);
      const { fetchN8nApi } = await import("@/lib/n8n-client");
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockWorkflow] }),
      });

      await n8nAdapter.syncWorkflows(connection);

      // Verify create was called with provider and externalId
      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: "n8n",
          externalId: "n8n-wf-123",
        }),
      });
    });

    it("should set provider and externalId when updating workflow", async () => {
      const existing = {
        id: "db-id",
        provider: "n8n",
        externalId: "n8n-wf-123",
      };

      (prisma.workflow.findUnique as any).mockResolvedValue(existing);
      const { fetchN8nApi } = await import("@/lib/n8n-client");
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "n8n-wf-123", name: "Updated", active: true, nodes: [], connections: {} }] }),
      });

      await n8nAdapter.syncWorkflows(connection);

      expect(prisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            provider_externalId: {
              provider: "n8n",
              externalId: "n8n-wf-123",
            },
          },
        })
      );
    });
  });

  describe("Adapter lookup prioritizes (provider, externalId)", () => {
    it("should check provider+externalId first", async () => {
      const existing = {
        id: "db-id",
        provider: "n8n",
        externalId: "n8n-wf-123",
      };

      (prisma.workflow.findUnique as any).mockResolvedValueOnce(existing);
      const { fetchN8nApi } = await import("@/lib/n8n-client");
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "n8n-wf-123", name: "Test", active: true, nodes: [], connections: {} }] }),
      });

      await n8nAdapter.syncWorkflows(connection);

      // Should check provider_externalId first
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: {
          provider_externalId: {
            provider: "n8n",
            externalId: "n8n-wf-123",
          },
        },
      });
    });

    it("should fall back to legacy constraint if provider+externalId not found", async () => {
      (prisma.workflow.findUnique as any)
        .mockResolvedValueOnce(null) // No match by provider+externalId
        .mockResolvedValueOnce({
          // Legacy workflow found
          id: "db-id",
          connectionId: "conn-1",
          toolWorkflowId: "n8n-wf-123",
        });

      const { fetchN8nApi } = await import("@/lib/n8n-client");
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "n8n-wf-123", name: "Test", active: true, nodes: [], connections: {} }] }),
      });

      await n8nAdapter.syncWorkflows(connection);

      // Should check legacy constraint second
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: {
          connectionId_toolWorkflowId: {
            connectionId: "conn-1",
            toolWorkflowId: "n8n-wf-123",
          },
        },
      });
    });
  });

  describe("Make adapter exists and compiles", () => {
    it("should have MakeAdapter class", () => {
      expect(MakeAdapter).toBeDefined();
      expect(makeAdapter).toBeInstanceOf(MakeAdapter);
    });

    it("should have provider property set to 'make'", () => {
      expect(makeAdapter.provider).toBe("make");
    });

    it("should implement ProviderAdapter interface", () => {
      expect(makeAdapter.fetchWorkflows).toBeDefined();
      expect(makeAdapter.normalizeWorkflow).toBeDefined();
      expect(makeAdapter.syncWorkflows).toBeDefined();
    });
  });

  describe("Normalization produces provider-agnostic Workflow", () => {
    it("should normalize n8n workflow to generic Workflow", () => {
      const rawN8n = {
        id: "n8n-123",
        name: "Test",
        active: true,
        nodes: [{ id: "n1", name: "Webhook", type: "n8n-nodes-base.webhook" }],
        connections: {},
      };

      const normalized = n8nAdapter.normalizeWorkflow(rawN8n, "conn-1");

      expect(normalized).not.toBeNull();
      expect(normalized?.provider).toBe("n8n");
      expect(normalized?.id).toBe("n8n-123");
      expect(normalized?.graph).toBeDefined();
      expect(normalized?.graph?.nodes).toBeDefined();
      // Should not have n8n-specific fields exposed
      expect(normalized).not.toHaveProperty("nodes");
      expect(normalized).not.toHaveProperty("connections");
    });

    it("should normalize make workflow to generic Workflow", () => {
      const rawMake = {
        id: "make-456",
        name: "Test Make",
        enabled: true,
        modules: [{ id: "m1", name: "Webhook", type: "make.webhook" }],
        connections: {},
      };

      const normalized = makeAdapter.normalizeWorkflow(rawMake, "conn-2");

      expect(normalized).not.toBeNull();
      expect(normalized?.provider).toBe("make");
      expect(normalized?.id).toBe("make-456");
      expect(normalized?.graph).toBeDefined();
      // Should use generic graph structure, not make-specific "modules"
      expect(normalized).not.toHaveProperty("modules");
    });
  });
});
