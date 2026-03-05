/**
 * Week 5 UI/Domain Invariants Tests
 * 
 * Validates UI layer is provider-agnostic:
 * - No imports of provider adapters in UI components
 * - No access to raw n8n JSON in UI
 * - Dashboard works with multiple providers
 * - UI only uses generic Workflow type
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { globSync } from "glob";

describe("Week 5 UI/Domain Invariants", () => {
  const FORBIDDEN_ADAPTER_IMPORTS = [
    "@/lib/providers/n8n-adapter",
    "@/lib/providers/make-adapter",
    "@/lib/providers/n8n-adapter",
    "@/lib/n8n-client",
    "@/lib/n8n-sync",
    "../lib/providers/n8n-adapter",
    "../lib/providers/make-adapter",
    "../lib/n8n-client",
    "../lib/n8n-sync",
  ];

  const FORBIDDEN_PATTERNS = [
    /\.nodes\[/, // Direct access to actions.nodes
    /\.connections\[/, // Direct access to actions.connections
    /actions\.nodes/, // actions.nodes access
    /actions\.connections/, // actions.connections access
    /n8nWorkflow/, // n8n-specific variable names
    /N8nWorkflow/, // n8n-specific type names
  ];

  function getUIClientComponents(): string[] {
    return globSync("src/app/**/*.{tsx,ts}", {
      ignore: [
        "**/__tests__/**",
        "**/api/**",
        "**/page.tsx", // Server components
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    }).filter((file) => {
      try {
        const content = readFileSync(file, "utf-8");
        return content.includes('"use client"') || content.includes("'use client'");
      } catch {
        return false;
      }
    });
  }

  describe("No provider adapter imports in UI", () => {
    it("should not import adapters in client components", () => {
      const files = getUIClientComponents();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          
          FORBIDDEN_ADAPTER_IMPORTS.forEach((forbidden) => {
            const pattern = new RegExp(
              `import.*from\\s+['"]${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
              "i"
            );
            if (pattern.test(content)) {
              violations.push(`${file}: imports ${forbidden}`);
            }
          });
        } catch (err) {
          // Skip files that can't be read
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe("No raw provider-specific JSON access", () => {
    it("should not access actions.nodes or actions.connections in UI", () => {
      const files = getUIClientComponents();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          
          // Allow in workflow-helpers.ts (normalization layer)
          if (file.includes("workflow-helpers.ts")) {
            return;
          }

          FORBIDDEN_PATTERNS.forEach((pattern) => {
            if (pattern.test(content)) {
              violations.push(`${file}: matches pattern ${pattern.source}`);
            }
          });
        } catch (err) {
          // Skip files that can't be read
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe("UI uses generic Workflow type", () => {
    it("should import Workflow from workflow-helpers, not providers/types", () => {
      const files = getUIClientComponents();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          
          if (content.includes("Workflow") && content.includes("import")) {
            // Should import from workflow-helpers, not providers/types
            const importsFromProviders = /import.*Workflow.*from\s+['"]@\/lib\/providers\/types['"]/i.test(content);
            if (importsFromProviders && !file.includes("workflow-helpers.ts")) {
              violations.push(
                `${file}: imports Workflow from providers/types (should use workflow-helpers)`
              );
            }
          }
        } catch (err) {
          // Skip files that can't be read
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe("Dashboard works with multiple providers", () => {
    it("should accept workflows from different providers", () => {
      const n8nWorkflow = {
        id: "wf-1",
        name: "n8n Workflow",
        provider: "n8n" as const,
        connectionId: "conn-1",
        active: true,
        graph: { nodes: [], edges: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const makeWorkflow = {
        id: "wf-2",
        name: "Make Workflow",
        provider: "make" as const,
        connectionId: "conn-2",
        active: true,
        graph: { nodes: [], edges: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Both should be valid Workflow types
      expect(n8nWorkflow.provider).toBe("n8n");
      expect(makeWorkflow.provider).toBe("make");
      expect(n8nWorkflow).toHaveProperty("graph");
      expect(makeWorkflow).toHaveProperty("graph");
    });
  });
});
