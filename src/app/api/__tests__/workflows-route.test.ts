/**
 * API Route Filtering Tests
 * 
 * Validates /api/workflows filtering behavior for provider and tool params.
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
    name: wf.name,
    provider: (wf.config as Record<string, unknown>)?.provider || "n8n",
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

  describe("Provider filtering (?provider=)", () => {
    it("should filter by provider=n8n", async () => {
      const n8nWorkflow = createMockWorkflow("n8n", "n8n-1", "int-1");
      const makeWorkflow = createMockWorkflow("make", "make-1", "int-2");

      (prisma.workflow.findMany as any).mockResolvedValue([n8nWorkflow, makeWorkflow]);

      const req = createRequest("http://localhost:3000/api/workflows?provider=n8n");
      const response = await GET(req);
      const data = await response.json();

      expect(prisma.workflow.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          integration: { provider: "n8n" },
        },
        include: { integration: true },
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
            integration: { provider: "make" },
          }),
        })
      );
    });
  });

  describe("Integration ID filtering", () => {
    it("should filter by integrationId (or connectionId query param)", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?integrationId=int-123"
      );
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integrationId: "int-123",
          }),
        })
      );
    });

    it("should combine integrationId with provider", async () => {
      (prisma.workflow.findMany as any).mockResolvedValue([]);

      const req = createRequest(
        "http://localhost:3000/api/workflows?connectionId=int-123&provider=n8n"
      );
      await GET(req);

      expect(prisma.workflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integrationId: "int-123",
            integration: { provider: "n8n" },
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
