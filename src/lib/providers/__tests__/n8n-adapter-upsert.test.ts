/**
 * N8N Adapter Upsert Tests
 * 
 * Validates the three-tier upsert logic:
 * 1. New world: workflow exists by (provider, externalId) → update
 * 2. Migration: workflow exists by (connectionId, toolWorkflowId) → update + populate provider/externalId
 * 3. Create: no match → create new workflow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { N8NAdapter } from "../n8n-adapter";
import type { ProviderConnection } from "../types";
import { PrismaClient } from "@prisma/client";

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
import { fetchN8nApi } from "@/lib/n8n-client";

describe("N8N Adapter Upsert Logic", () => {
  let adapter: N8NAdapter;
  let connection: ProviderConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new N8NAdapter();
    connection = {
      id: "conn-1",
      provider: "n8n",
      userId: "user-1",
      status: "ACTIVE",
      config: {
        baseUrl: "https://n8n.example.com",
        apiPath: "/rest",
      },
    };
  });

  const mockN8nWorkflow = {
    id: "n8n-wf-123",
    name: "Test Workflow",
    active: true,
    nodes: [
      {
        id: "node-1",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
      },
    ],
    connections: {},
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  describe("New world: workflow exists by (provider, externalId)", () => {
    it("should update existing workflow when found by provider+externalId", async () => {
      const existingWorkflow = {
        id: "db-id-1",
        provider: "n8n",
        externalId: "n8n-wf-123",
        connectionId: "conn-1",
        name: "Old Name",
        status: "inactive",
      };

      (prisma.workflow.findUnique as any).mockResolvedValueOnce(existingWorkflow);
      (fetchN8nApi as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockN8nWorkflow] }),
      });

      const result = await adapter.syncWorkflows(connection);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      
      // Should have checked for new unique constraint first
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: {
          provider_externalId: {
            provider: "n8n",
            externalId: "n8n-wf-123",
          },
        },
      });

      // Should update the existing workflow
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: {
          provider_externalId: {
            provider: "n8n",
            externalId: "n8n-wf-123",
          },
        },
        data: expect.objectContaining({
          name: "Test Workflow",
          status: "active",
          connectionId: "conn-1",
        }),
      });

      // Should NOT check legacy constraint
      expect(prisma.workflow.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("Migration: workflow exists by (connectionId, toolWorkflowId)", () => {
    it("should update legacy workflow and populate provider/externalId", async () => {
      // First check (new constraint) returns null
      (prisma.workflow.findUnique as any)
        .mockResolvedValueOnce(null) // No match by provider+externalId
        .mockResolvedValueOnce({
          // Legacy workflow found
          id: "db-id-2",
          connectionId: "conn-1",
          toolWorkflowId: "n8n-wf-123",
          provider: null, // Missing provider
          externalId: null, // Missing externalId
          name: "Old Name",
          status: "inactive",
        });

      (fetchN8nApi as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockN8nWorkflow] }),
      });

      const result = await adapter.syncWorkflows(connection);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);

      // Should check legacy constraint after new constraint fails
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: {
          connectionId_toolWorkflowId: {
            connectionId: "conn-1",
            toolWorkflowId: "n8n-wf-123",
          },
        },
      });

      // Should update legacy workflow AND populate provider/externalId
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: {
          connectionId_toolWorkflowId: {
            connectionId: "conn-1",
            toolWorkflowId: "n8n-wf-123",
          },
        },
        data: expect.objectContaining({
          provider: "n8n",
          externalId: "n8n-wf-123",
          name: "Test Workflow",
          status: "active",
        }),
      });
    });
  });

  describe("Create: no existing workflow", () => {
    it("should create new workflow with provider+externalId + legacy fields", async () => {
      // Both checks return null (no existing workflow)
      (prisma.workflow.findUnique as any)
        .mockResolvedValueOnce(null) // No match by provider+externalId
        .mockResolvedValueOnce(null); // No match by legacy constraint

      (fetchN8nApi as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockN8nWorkflow] }),
      });

      const result = await adapter.syncWorkflows(connection);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);

      // Should create new workflow with all fields
      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          connectionId: "conn-1",
          provider: "n8n",
          externalId: "n8n-wf-123",
          toolWorkflowId: "n8n-wf-123", // Legacy field still populated
          name: "Test Workflow",
          status: "active",
        }),
      });
    });
  });

  describe("Concurrency and duplicates", () => {
    it("should not create duplicates when syncing same workflow twice", async () => {
      const existingWorkflow = {
        id: "db-id-1",
        provider: "n8n",
        externalId: "n8n-wf-123",
        connectionId: "conn-1",
      };

      (prisma.workflow.findUnique as any).mockResolvedValue(existingWorkflow);
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockN8nWorkflow] }),
      });

      // Sync twice
      await adapter.syncWorkflows(connection);
      await adapter.syncWorkflows(connection);

      // Should update twice, never create
      expect(prisma.workflow.update).toHaveBeenCalledTimes(2);
      expect(prisma.workflow.create).not.toHaveBeenCalled();
    });
  });

  describe("Provider consistency", () => {
    it("should ensure provider matches connection provider", async () => {
      (prisma.workflow.findUnique as any).mockResolvedValue(null);
      (fetchN8nApi as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockN8nWorkflow] }),
      });

      await adapter.syncWorkflows(connection);

      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: "n8n", // Must match connection.provider
          connectionId: "conn-1",
        }),
      });
    });
  });
});
