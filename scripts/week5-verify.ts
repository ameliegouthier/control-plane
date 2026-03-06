#!/usr/bin/env tsx
/**
 * Week 5 Verification Script
 * 
 * Runs all Week 5 verification checks and reports PASS/FAIL.
 * 
 * Usage: npm run week5:verify
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { globSync } from "glob";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, "green");
}

function error(message: string) {
  log(`❌ ${message}`, "red");
}

function info(message: string) {
  log(`ℹ️  ${message}`, "blue");
}

function section(title: string) {
  log(`\n${"=".repeat(60)}`, "cyan");
  log(title, "cyan");
  log("=".repeat(60), "cyan");
}

interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: CheckResult[] = [];

function addResult(name: string, passed: boolean, message?: string) {
  results.push({ name, passed, message });
  if (passed) {
    success(`${name}: PASS`);
  } else {
    error(`${name}: FAIL${message ? ` - ${message}` : ""}`);
  }
}

async function checkPrismaSchema() {
  section("A) Database/Schema Invariants");
  
  try {
    const schema = readFileSync("prisma/schema.prisma", "utf-8");
    
    // Check provider field exists
    if (schema.includes('provider      String')) {
      addResult("Provider field exists in schema", true);
    } else {
      addResult("Provider field exists in schema", false, "Missing provider field");
    }

    // Check externalId field exists
    if (schema.includes('externalId    String')) {
      addResult("ExternalId field exists in schema", true);
    } else {
      addResult("ExternalId field exists in schema", false, "Missing externalId field");
    }

    // Check unique constraint
    if (schema.includes('@@unique([provider, externalId])')) {
      addResult("Unique constraint on (provider, externalId)", true);
    } else {
      addResult("Unique constraint on (provider, externalId)", false, "Missing unique constraint");
    }

    // Check toolWorkflowId is nullable
    if (schema.includes('toolWorkflowId String?')) {
      addResult("toolWorkflowId is nullable (backward compat)", true);
    } else {
      addResult("toolWorkflowId is nullable (backward compat)", false, "toolWorkflowId should be nullable");
    }

    // Check connectionId relation
    if (schema.includes('connectionId  String') && schema.includes('connection    Connection @relation')) {
      addResult("Workflow belongs to Connection", true);
    } else {
      addResult("Workflow belongs to Connection", false, "Missing connectionId relation");
    }
  } catch (err) {
    addResult("Schema file readable", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkMigrationExists() {
  try {
    const migrations = globSync("prisma/migrations/**/migration.sql");
    const week5Migration = migrations.find((m) => m.includes("add_provider_and_external_id"));
    
    if (week5Migration) {
      const migrationSQL = readFileSync(week5Migration, "utf-8");
      
      if (migrationSQL.includes('ADD COLUMN "provider"') && migrationSQL.includes('ADD COLUMN "externalId"')) {
        addResult("Week 5 migration exists", true);
      } else {
        addResult("Week 5 migration exists", false, "Migration missing provider/externalId columns");
      }
    } else {
      addResult("Week 5 migration exists", false, "Migration file not found");
    }
  } catch (err) {
    addResult("Week 5 migration exists", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkAdapters() {
  section("B) Adapter Invariants");
  
  try {
    // Check n8n adapter exists
    const n8nAdapter = readFileSync("src/lib/providers/n8n-adapter.ts", "utf-8");
    if (n8nAdapter.includes('provider: "n8n"') && n8nAdapter.includes("externalId")) {
      addResult("n8n adapter writes provider + externalId", true);
    } else {
      addResult("n8n adapter writes provider + externalId", false, "Adapter missing provider/externalId logic");
    }

    // Check make adapter exists
    const makeAdapter = readFileSync("src/lib/providers/make-adapter.ts", "utf-8");
    if (makeAdapter.includes('provider: "make"')) {
      addResult("Make adapter exists", true);
    } else {
      addResult("Make adapter exists", false, "Make adapter not found");
    }
  } catch (err) {
    addResult("Adapters check", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkUIComponents() {
  section("C) UI/Domain Invariants");
  
  const FORBIDDEN_IMPORTS = [
    "@/lib/providers/n8n-adapter",
    "@/lib/n8n-client",
    "@/lib/n8n-sync",
  ];

  try {
    const uiFiles = globSync("src/app/**/*.{tsx,ts}", {
      ignore: [
        "**/__tests__/**",
        "**/api/**",
        "**/page.tsx",
        "**/*.test.ts",
      ],
    }).filter((file) => {
      try {
        const content = readFileSync(file, "utf-8");
        return content.includes('"use client"');
      } catch {
        return false;
      }
    });

    let violations = 0;
    uiFiles.forEach((file) => {
      const content = readFileSync(file, "utf-8");
      FORBIDDEN_IMPORTS.forEach((forbidden) => {
        if (content.includes(forbidden)) {
          violations++;
        }
      });
    });

    if (violations === 0) {
      addResult("No adapter imports in UI components", true);
    } else {
      addResult("No adapter imports in UI components", false, `Found ${violations} violations`);
    }
  } catch (err) {
    addResult("UI components check", false, err instanceof Error ? err.message : String(err));
  }
}

async function checkDemoWorkflows() {
  section("D) Demo Mode Invariants");
  
  try {
    const demoWorkflows = readFileSync("src/lib/demo/demoWorkflows.ts", "utf-8");
    
    // Check for multiple providers
    const hasN8n = demoWorkflows.includes('provider: "n8n"');
    const hasMake = demoWorkflows.includes('provider: "make"');
    
    if (hasN8n && hasMake) {
      addResult("Demo workflows include n8n + make", true);
    } else {
      addResult("Demo workflows include n8n + make", false, `n8n: ${hasN8n}, make: ${hasMake}`);
    }

    // Check DEMO_WORKFLOWS export
    if (demoWorkflows.includes("export const DEMO_WORKFLOWS")) {
      addResult("Demo workflows exported", true);
    } else {
      addResult("Demo workflows exported", false, "DEMO_WORKFLOWS not exported");
    }
  } catch (err) {
    addResult("Demo workflows check", false, err instanceof Error ? err.message : String(err));
  }
}

async function runTests() {
  section("E) Running Test Suite");
  
  try {
    info("Running Week 5 verification tests...");
    // Run all week5 test files
    const testFiles = [
      "week5-schema",
      "week5-adapters",
      "week5-ui-agnostic",
      "week5-api",
      "week5-demo",
    ];
    
    let allPassed = true;
    for (const testFile of testFiles) {
      try {
        execSync(`npm test -- ${testFile}`, { stdio: "pipe" });
        success(`  ${testFile}: PASS`);
      } catch (err) {
        allPassed = false;
        error(`  ${testFile}: FAIL`);
      }
    }
    
    if (allPassed) {
      addResult("All Week 5 tests pass", true);
    } else {
      addResult("All Week 5 tests pass", false, "Some tests failed - run 'npm test' for details");
    }
  } catch (err) {
    addResult("All Week 5 tests pass", false, "Test execution error");
  }
}

async function main() {
  log("\n🔍 Week 5 Verification Report", "cyan");
  log("=".repeat(60), "cyan");

  await checkPrismaSchema();
  await checkMigrationExists();
  await checkAdapters();
  await checkUIComponents();
  await checkDemoWorkflows();
  await runTests();

  // Summary
  section("Summary");
  
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const allPassed = results.every((r) => r.passed);

  log(`\nResults: ${passed}/${total} checks passed`, allPassed ? "green" : "yellow");

  if (allPassed) {
    success("\n✅ Week 5 verification PASSED!");
    log("\nAll invariants are satisfied. Architecture is provider-agnostic.", "green");
    process.exit(0);
  } else {
    error("\n❌ Week 5 verification FAILED!");
    log("\nSome checks failed. Review the errors above and fix issues.", "red");
    process.exit(1);
  }
}

main().catch((e) => {
  error(`Unexpected error: ${e}`);
  process.exit(1);
});
