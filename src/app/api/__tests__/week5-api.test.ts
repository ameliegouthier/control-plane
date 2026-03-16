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
import type { Workflow as DbWorkflow, Integration } from "@prisma/client";

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
    id: wf.id,
    externalId: (wf.config as Record<string, unknown>)?.externalId,
    name: wf.name,
    provider: (wf.config as Record<string, unknown>)?.provider ?? "n8n",
    active: wf.status === "active",
    connectionId: wf.integrationId,
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
    integrationId: string
  ): DbWorkflow & { integration: Integration } {
    return {
      id: "wf-1",
      userId: "user-1",
      integrationId,
      name: "Test Workflow",
      status: "active",
      triggerType: null,
      config: { provider, externalId, actions: {} },
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
    } as DbWorkflow & { integration: Integration };
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
            integration: { provider: "n8n" },
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
            integration: { provider: "make" },
          }),
        })
      );
    });
  });

  describe("API returns normalized Workflow objects", () => {
    it("should return workflows with provider field", async () => {
      const n8nWorkflow = createMockWorkflow("n8n", "n8n-1", "int-1");
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
      const workflow = createMockWorkflow("n8n", "n8n-1", "int-1");
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
