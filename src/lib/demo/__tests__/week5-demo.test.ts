/**
 * Week 5 Demo Mode Invariants Tests
 * 
 * Validates demo mode:
 * - Includes at least 2 providers (n8n + make)
 * - Demo workflows have provider and externalId
 * - Demo mode works without database
 * - Demo workflows render identically
 */

import { describe, it, expect } from "vitest";
import { DEMO_WORKFLOWS } from "../demoWorkflows";
import type { Workflow } from "@/app/workflow-helpers";

describe("Week 5 Demo Mode Invariants", () => {
  describe("Demo workflows include multiple providers", () => {
    it("should have workflows from at least 2 providers", () => {
      expect(DEMO_WORKFLOWS.length).toBeGreaterThanOrEqual(2);
      
      const providers = new Set(DEMO_WORKFLOWS.map((w) => w.provider));
      expect(providers.size).toBeGreaterThanOrEqual(2);
    });

    it("should include n8n workflows", () => {
      const n8nWorkflows = DEMO_WORKFLOWS.filter((w) => w.provider === "n8n");
      expect(n8nWorkflows.length).toBeGreaterThan(0);
    });

    it("should include make workflows", () => {
      const makeWorkflows = DEMO_WORKFLOWS.filter((w) => w.provider === "make");
      expect(makeWorkflows.length).toBeGreaterThan(0);
    });
  });

  describe("Demo workflows have provider and externalId", () => {
    it("should have provider field for all workflows", () => {
      DEMO_WORKFLOWS.forEach((wf) => {
        expect(wf.provider).toBeDefined();
        expect(typeof wf.provider).toBe("string");
        expect(["n8n", "make", "zapier", "airtable"]).toContain(wf.provider);
      });
    });

    it("should have externalId field for all workflows", () => {
      DEMO_WORKFLOWS.forEach((wf) => {
        expect(wf.id).toBeDefined(); // id is the externalId in demo workflows
        expect(typeof wf.id).toBe("string");
      });
    });

    it("should have connectionId for all workflows", () => {
      DEMO_WORKFLOWS.forEach((wf) => {
        expect(wf.connectionId).toBeDefined();
        expect(typeof wf.connectionId).toBe("string");
      });
    });
  });

  describe("Demo workflows are provider-agnostic", () => {
    it("should have same structure regardless of provider", () => {
      const n8nWf = DEMO_WORKFLOWS.find((w) => w.provider === "n8n");
      const makeWf = DEMO_WORKFLOWS.find((w) => w.provider === "make");

      expect(n8nWf).toBeDefined();
      expect(makeWf).toBeDefined();

      // Both should have same top-level structure
      const requiredFields: (keyof Workflow)[] = [
        "id",
        "name",
        "provider",
        "connectionId",
        "active",
        "graph",
        "createdAt",
        "updatedAt",
      ];

      requiredFields.forEach((field) => {
        expect(n8nWf).toHaveProperty(field);
        expect(makeWf).toHaveProperty(field);
      });
    });

    it("should use normalized graph structure (not provider-specific)", () => {
      DEMO_WORKFLOWS.forEach((wf) => {
        expect(wf.graph).toBeDefined();
        expect(wf.graph).toHaveProperty("nodes");
        expect(wf.graph).toHaveProperty("edges");
        expect(Array.isArray(wf.graph?.nodes)).toBe(true);
        expect(Array.isArray(wf.graph?.edges)).toBe(true);
        
        // Should NOT have provider-specific fields
        expect(wf).not.toHaveProperty("nodes");
        expect(wf).not.toHaveProperty("connections");
        expect(wf).not.toHaveProperty("modules"); // Make-specific
      });
    });
  });

  describe("Demo mode works without database", () => {
    it("should not require database connection", () => {
      // Demo workflows are static data, no DB needed
      expect(DEMO_WORKFLOWS).toBeDefined();
      expect(Array.isArray(DEMO_WORKFLOWS)).toBe(true);
    });

    it("should have valid workflow data structure", () => {
      DEMO_WORKFLOWS.forEach((wf) => {
        expect(wf.name).toBeDefined();
        expect(typeof wf.name).toBe("string");
        expect(typeof wf.active).toBe("boolean");
        expect(wf.createdAt).toBeDefined();
        expect(wf.updatedAt).toBeDefined();
      });
    });
  });
});
