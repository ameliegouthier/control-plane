/**
 * Week 5 API Invariants Tests
 * 
 * Validates API route behavior:
 * - /api/workflows supports ?provider=
 * - Legacy ?tool= still works
 * - Precedence when both params provided
 * - API returns normalized Workflow objects
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../workflows/route";
import { NextRequest } from "next/server";
import type { Workflow as DbWorkflow, Connection, ToolType } from "@prisma/client";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    workflow: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/demo-user", () => ({
  getDemoUser: vi.fn(() => Promise.resolve({ id: "user-1" })),
}));

vi.mock("@/app/workflow-helpers", () => ({
  toWorkflow: vi.fn((wf: DbWorkflow) => ({
    id: wf.externalId || wf.toolWorkflowId,
    name: wf.name,
    provider: wf.provider || "n8n",
    active: wf.status === "active",
    connectionId: wf.connectionId,
  })),
}));

import { prisma } from "@/lib/prisma";

describe("Week 5 API Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockWorkflow(
    provider: string,
    externalId: string,
    tool: ToolType,
    connectionId: string
  ): DbWorkflow & { connection: Connection } {
    return {
      id: "wf-1",
      userId: "user-1",
      connectionId,
      provider: provider as any,
      externalId,
      toolWorkflowId: externalId,
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      triggerConfig: null,
      actions: {},
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

  function createRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, "http://localhost:3000"));
  }

  describe("Provider parameter support", () => {
    it("should filter by provider=n8n", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest("http://localhost:3000/api/workflows?provider=n8n");
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: "n8n",
          }),
        })
      );
    });

    it("should filter by provider=make", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest("http://localhost:3000/api/workflows?provider=make");
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: "make",
          }),
        })
      );
    });
  });

  describe("Legacy tool parameter support", () => {
    it("should filter by tool=N8N (legacy)", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest("http://localhost:3000/api/workflows?tool=N8N");
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connection: { tool: "N8N" },
          }),
        })
      );
    });

    it("should filter by tool=MAKE (legacy)", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest("http://localhost:3000/api/workflows?tool=MAKE");
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connection: { tool: "MAKE" },
          }),
        })
      );
    });
  });

  describe("Parameter precedence", () => {
    it("should prefer provider when both provider and tool are provided", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?provider=n8n&tool=MAKE"
      );
      await GET(req);

      const callArgs = (prisma.workflow.findMany as any).mock.calls[0][0];
      
      // Provider should win
      expect(callArgs.where.provider).toBe("n8n");
      // Connection.tool should NOT be set
      expect(callArgs.where.connection).toBeUndefined();
    });
  });

  describe("API returns normalized Workflow objects", () => {
    it("should return workflows with provider field", async () => {
      const n8nWorkflow = createMockWorkflow("n8n", "n8n-1", "N8N", "conn-1");
      (prisma.workflow.findMany as any).mockResolvedValue([n8nWorkflow]);

      const req = createRequest("http://localhost:3000/api/workflows?provider=n8n");
      const response = await GET(req);
      const data = await response.json();

      expect(data.data).toBeDefined();
      expect(data.data.length).toBeGreaterThan(0);
      // Workflows should be normalized (no raw DB fields)
      expect(data.data[0]).not.toHaveProperty("toolWorkflowId");
      expect(data.data[0]).toHaveProperty("provider");
    });

    it("should not expose provider-specific internals", async () => {
      const workflow = createMockWorkflow("n8n", "n8n-1", "N8N", "conn-1");
      (prisma.workflow.findMany as any).mockResolvedValue([workflow]);

      const req = createRequest("http://localhost:3000/api/workflows");
      const response = await GET(req);
      const data = await response.json();

      // Should not have raw actions.nodes or actions.connections
      expect(data.data[0]).not.toHaveProperty("actions");
      // Should have normalized graph if present
      // (toWorkflow mock doesn't include graph, but real implementation would)
    });
  });
});
