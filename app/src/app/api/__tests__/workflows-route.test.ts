/**
 * API Route Filtering Tests
 * 
 * Validates /api/workflows filtering behavior for provider and tool params.
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
  })),
}));

import { prisma } from "@/lib/prisma";

describe("GET /api/workflows", () => {
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

  describe("Provider filtering (?provider=)", () => {
    it("should filter by provider=n8n", async () => {
      const n8nWorkflow = createMockWorkflow("n8n", "n8n-1", "N8N", "conn-1");
      const makeWorkflow = createMockWorkflow("make", "make-1", "MAKE", "conn-2");

      (prisma.workflow.findMany as any).mockResolvedValue([n8nWorkflow, makeWorkflow]);

      const req = createRequest("http://localhost:3000/api/workflows?provider=n8n");
      const response = await GET(req);
      const data = await response.json();

      expect(prisma.workflow.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          provider: "n8n",
        },
        include: { connection: true },
        orderBy: { updatedAt: "desc" },
      });

      // Note: In real scenario, Prisma would filter, but we're testing the query construction
      expect(data.count).toBe(2); // Mock returns both, but real query would filter
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

  describe("Legacy tool filtering (?tool=)", () => {
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

  describe("Precedence: provider vs tool", () => {
    it("should prefer provider when both params are set", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?provider=n8n&tool=MAKE"
      );
      await GET(req);

      // Provider should win (preferred)
      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: "n8n",
          }),
        })
      );

      // Should NOT include connection.tool filter
      const callArgs = (prisma.workflow.findMany as any).mock.calls[0][0];
      expect(callArgs.where.connection).toBeUndefined();
    });
  });

  describe("Connection ID filtering", () => {
    it("should filter by connectionId", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?connectionId=conn-123"
      );
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connectionId: "conn-123",
          }),
        })
      );
    });

    it("should combine connectionId with provider", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?connectionId=conn-123&provider=n8n"
      );
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connectionId: "conn-123",
            provider: "n8n",
          }),
        })
      );
    });
  });

  describe("No filters", () => {
    it("should return all workflows for user when no filters", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest("http://localhost:3000/api/workflows");
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: "user-1",
          },
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should return 500 on database error", async () => {
      (prisma.workflow.findMany as any).mockRejectedValue(
        new Error("Database error")
      );

      const req = createRequest("http://localhost:3000/api/workflows");
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to load workflows");
    });
  });
});
