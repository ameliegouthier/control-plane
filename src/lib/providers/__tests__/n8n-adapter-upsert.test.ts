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

// Mock Prisma (Integration model: workflow uses findFirst, integrationId, config; syncWorkflowNodes uses workflowNode)
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflow: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    workflowNode: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    integration: {
      update: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}));

// Mock n8n client
const getWorkflowsMock = vi.fn();
vi.mock("@/lib/n8n-client", () => ({
  N8nClient: vi.fn().mockImplementation(() => ({
    getWorkflows: getWorkflowsMock,
  })),
}));

import { prisma } from "@/lib/prisma";

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

  describe("Upsert by integrationId + name", () => {
    it("should update existing workflow when found by integrationId and name", async () => {
      const existingWorkflow = {
        id: "db-id-1",
        integrationId: "conn-1",
        name: "Test Workflow",
        status: "inactive",
      };

      (prisma.workflow.findFirst as any).mockResolvedValueOnce(existingWorkflow);
      getWorkflowsMock.mockResolvedValueOnce({ data: [mockN8nWorkflow] });

      const result = await adapter.syncWorkflows(connection);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);

      expect(prisma.workflow.findFirst).toHaveBeenCalledWith({
        where: { integrationId: "conn-1", name: "Test Workflow" },
      });

      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: "db-id-1" },
        data: expect.objectContaining({
          name: "Test Workflow",
          status: "active",
        }),
      });
    });
  });

  describe("Create: no existing workflow", () => {
    it("should create new workflow with integrationId and config", async () => {
      (prisma.workflow.findFirst as any).mockResolvedValueOnce(null);
      (prisma.workflow.create as any).mockResolvedValueOnce({
        id: "new-db-id",
        integrationId: "conn-1",
        name: "Test Workflow",
      });

      getWorkflowsMock.mockResolvedValueOnce({ data: [mockN8nWorkflow] });

      const result = await adapter.syncWorkflows(connection);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);

      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          integrationId: "conn-1",
          name: "Test Workflow",
          status: "active",
          config: expect.objectContaining({
            provider: "n8n",
            externalId: "n8n-wf-123",
          }),
        }),
      });
    });
  });

  describe("Concurrency and duplicates", () => {
    it("should not create duplicates when syncing same workflow twice", async () => {
      const existingWorkflow = {
        id: "db-id-1",
        integrationId: "conn-1",
        name: "Test Workflow",
      };

      (prisma.workflow.findFirst as any).mockResolvedValue(existingWorkflow);
      getWorkflowsMock.mockResolvedValue({ data: [mockN8nWorkflow] });

      await adapter.syncWorkflows(connection);
      await adapter.syncWorkflows(connection);

      expect(prisma.workflow.update).toHaveBeenCalledTimes(2);
      expect(prisma.workflow.create).not.toHaveBeenCalled();
    });
  });

  describe("Provider consistency", () => {
    it("should store provider in config matching connection", async () => {
      (prisma.workflow.findFirst as any).mockResolvedValue(null);
      getWorkflowsMock.mockResolvedValue({ data: [mockN8nWorkflow] });

      await adapter.syncWorkflows(connection);

      expect(prisma.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          integrationId: "conn-1",
          config: expect.objectContaining({
            provider: "n8n",
          }),
        }),
      });
    });
  });
});
