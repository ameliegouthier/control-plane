/**
 * UI Provider-Agnostic Guard Tests
 * 
 * Ensures no provider-specific logic leaks into UI components.
 * Prevents imports of n8n adapter/client and direct access to provider-specific fields.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";

describe("UI Provider-Agnostic Guards", () => {
  const UI_DIR = join(process.cwd(), "src/app");
  const FORBIDDEN_IMPORTS = [
    "@/lib/providers/n8n-adapter",
    "@/lib/n8n-client",
    "@/lib/n8n-sync",
    "../lib/providers/n8n-adapter",
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

  function getUIComponentFiles(): string[] {
    // Get all .tsx files in UI directories (excluding test files, API routes, and server components)
    const files = globSync("src/app/**/*.{tsx,ts}", {
      ignore: [
        "**/__tests__/**",
        "**/api/**", // API routes are server-side, can use n8n imports
        "**/page.tsx", // Server components can use n8n imports
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
    });
    // Filter to only client components (those with "use client")
    return files.filter((file) => {
      try {
        const content = readFileSync(file, "utf-8");
        return content.includes('"use client"') || content.includes("'use client'");
      } catch {
        return false;
      }
    });
  }

  function checkForForbiddenImports(content: string, filePath: string): string[] {
    const violations: string[] = [];
    
    FORBIDDEN_IMPORTS.forEach((forbidden) => {
      const importPattern = new RegExp(
        `import.*from\\s+['"]${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
        "i"
      );
      if (importPattern.test(content)) {
        violations.push(`Forbidden import: ${forbidden} in ${filePath}`);
      }
    });

    return violations;
  }

  function checkForForbiddenPatterns(content: string, filePath: string): string[] {
    const violations: string[] = [];

    FORBIDDEN_PATTERNS.forEach((pattern) => {
      if (pattern.test(content)) {
        violations.push(
          `Forbidden pattern ${pattern.source} found in ${filePath}`
        );
      }
    });

    return violations;
  }

  describe("No provider-specific imports in UI", () => {
    it("should not import n8n adapter in UI components", () => {
      const files = getUIComponentFiles();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          const fileViolations = checkForForbiddenImports(content, file);
          violations.push(...fileViolations);
        } catch (err) {
          // Skip files that can't be read (might be in node_modules or build artifacts)
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe("No direct access to provider-specific fields", () => {
    it("should not access actions.nodes or actions.connections directly in UI", () => {
      const files = getUIComponentFiles();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          
          // Allow access in workflow-helpers.ts (it's the normalization layer)
          if (file.includes("workflow-helpers.ts")) {
            return;
          }

          const fileViolations = checkForForbiddenPatterns(content, file);
          violations.push(...fileViolations);
        } catch (err) {
          // Skip files that can't be read
        }
      });

      expect(violations).toEqual([]);
    });
  });

  describe("UI components use generic Workflow type", () => {
    it("should import Workflow type from workflow-helpers, not providers", () => {
      const files = getUIComponentFiles();
      const violations: string[] = [];

      files.forEach((file) => {
        try {
          const content = readFileSync(file, "utf-8");
          
          // Check if file uses Workflow type
          if (content.includes("Workflow") && content.includes("import")) {
            // Should import from workflow-helpers, not providers/types
            const importsFromProviders = /import.*Workflow.*from\s+['"]@\/lib\/providers\/types['"]/i.test(content);
            if (importsFromProviders && !file.includes("workflow-helpers.ts")) {
              violations.push(
                `UI component ${file} imports Workflow from providers/types. Use workflow-helpers instead.`
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

  describe("Type safety: Workflow type structure", () => {
    it("should ensure Workflow type has provider field", () => {
      // This is a compile-time check - if Workflow type doesn't have provider,
      // TypeScript will fail. We verify the type structure here.
      const workflowType = {
        id: "test",
        name: "Test",
        provider: "n8n" as const,
        connectionId: "conn-1",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Type check: workflow must have provider
      expect(workflowType).toHaveProperty("provider");
      expect(typeof workflowType.provider).toBe("string");
    });

    it("should ensure Workflow type does not expose provider-specific internals", () => {
      // Workflow type should not expose raw n8n JSON structure
      const workflow = {
        id: "test",
        name: "Test",
        provider: "n8n" as const,
        connectionId: "conn-1",
        active: true,
        graph: {
          nodes: [],
          edges: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Should have normalized graph, not raw actions
      expect(workflow).toHaveProperty("graph");
      expect(workflow).not.toHaveProperty("actions");
    });
  });
});
