# Week 5 Verification Plan

## Overview

This document defines the automated verification system for Week 5 multi-provider architecture hardening. The verification ensures the architecture is fully provider-agnostic and stable.

## Verification Categories

### A) Database/Schema Invariants

**Checks:**
- ✅ `provider` and `externalId` columns exist and are NOT NULL
- ✅ Unique constraint `@@unique([provider, externalId])` is enforced
- ✅ `toolWorkflowId` is nullable (backward compatibility)
- ✅ Workflows have valid `connectionId` (no orphans)
- ✅ Week 5 migration exists and is applied

**Tests:** `src/lib/__tests__/week5-schema.test.ts`

**Validation:**
- Schema file inspection
- Migration SQL verification
- Prisma schema validation

### B) Adapter Invariants

**Checks:**
- ✅ n8n adapter writes `provider` + `externalId` on create/update
- ✅ Adapter lookup prioritizes `(provider, externalId)`, falls back to legacy `(connectionId, toolWorkflowId)`
- ✅ Make adapter exists as stub and compiles
- ✅ Normalization produces provider-agnostic `Workflow` (no raw provider JSON)

**Tests:** `src/lib/providers/__tests__/week5-adapters.test.ts`

**Validation:**
- Adapter code inspection
- Mock Prisma calls verification
- Normalization output validation

### C) UI/Domain Invariants

**Checks:**
- ✅ No imports of provider adapters in UI components (only server/data layer)
- ✅ No access to raw n8n JSON in UI (`actions.nodes`, `actions.connections`)
- ✅ UI components only use generic `Workflow` type from `workflow-helpers`
- ✅ Dashboard rendering works with demo data for multiple providers

**Tests:** `src/app/__tests__/week5-ui-agnostic.test.ts`

**Validation:**
- Static code analysis (file scanning)
- Import pattern detection
- Type safety checks

### D) API Invariants

**Checks:**
- ✅ `/api/workflows` supports `?provider=` parameter
- ✅ Legacy `?tool=` parameter still works (backward compatibility)
- ✅ Precedence: `provider` wins when both `provider` and `tool` are provided
- ✅ API returns normalized `Workflow` objects (no raw DB fields)

**Tests:** `src/app/api/__tests__/week5-api.test.ts`

**Validation:**
- API route code inspection
- Query parameter handling verification
- Response format validation

### E) Demo Mode Invariants

**Checks:**
- ✅ Demo workflows include at least 2 providers (n8n + make)
- ✅ Demo workflows have `provider` and `externalId` fields
- ✅ Demo mode works without database connection
- ✅ Demo workflows use normalized structure (not provider-specific)

**Tests:** `src/lib/demo/__tests__/week5-demo.test.ts`

**Validation:**
- Demo data structure verification
- Provider diversity check
- Normalization consistency

## Running Verification

### Quick Verification

```bash
npm run week5:verify
```

This runs:
1. Schema checks (file inspection)
2. Migration verification
3. Adapter checks
4. UI component scanning
5. Demo workflow validation
6. Test suite execution

### Individual Test Categories

```bash
# Schema tests
npm test -- week5-schema

# Adapter tests
npm test -- week5-adapters

# UI tests
npm test -- week5-ui-agnostic

# API tests
npm test -- week5-api

# Demo tests
npm test -- week5-demo
```

### Full Test Suite

```bash
# Run all tests (including Week 5)
npm test

# Run with coverage
npm test -- --coverage
```

## Expected Output

### Success Case

```
🔍 Week 5 Verification Report
============================================================

A) Database/Schema Invariants
============================================================
✅ Provider field exists in schema: PASS
✅ ExternalId field exists in schema: PASS
✅ Unique constraint on (provider, externalId): PASS
✅ toolWorkflowId is nullable (backward compat): PASS
✅ Workflow belongs to Connection: PASS
✅ Week 5 migration exists: PASS

B) Adapter Invariants
============================================================
✅ n8n adapter writes provider + externalId: PASS
✅ Make adapter exists: PASS

C) UI/Domain Invariants
============================================================
✅ No adapter imports in UI components: PASS

D) Demo Mode Invariants
============================================================
✅ Demo workflows include n8n + make: PASS
✅ Demo workflows exported: PASS

E) Running Test Suite
============================================================
✅ All Week 5 tests pass: PASS

Summary
============================================================
Results: 12/12 checks passed

✅ Week 5 verification PASSED!
```

### Failure Case

```
❌ Provider field exists in schema: FAIL - Missing provider field
...
Summary
============================================================
Results: 8/12 checks passed

❌ Week 5 verification FAILED!
```

## Test Files Structure

```
src/
├── lib/
│   ├── __tests__/
│   │   └── week5-schema.test.ts          # Schema invariants
│   ├── providers/
│   │   └── __tests__/
│   │       └── week5-adapters.test.ts     # Adapter invariants
│   └── demo/
│       └── __tests__/
│           └── week5-demo.test.ts         # Demo mode invariants
├── app/
│   ├── __tests__/
│   │   └── week5-ui-agnostic.test.ts      # UI invariants
│   └── api/
│       └── __tests__/
│           └── week5-api.test.ts          # API invariants
scripts/
└── week5-verify.ts                        # Main verification script
```

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/week5-verify.yml
- name: Week 5 Verification
  run: npm run week5:verify
```

## Troubleshooting

### Tests Fail

1. Check test output for specific failures
2. Run individual test files to isolate issues
3. Verify Prisma schema matches migration
4. Check that all adapters are properly implemented

### Schema Checks Fail

1. Verify `prisma/schema.prisma` has `provider` and `externalId` fields
2. Check migration file exists: `prisma/migrations/*/add_provider_and_external_id/migration.sql`
3. Run `npm run db:status` to check migration status

### UI Checks Fail

1. Search codebase for forbidden imports: `grep -r "n8n-adapter" src/app`
2. Check client components don't import adapters
3. Verify UI only uses `Workflow` type from `workflow-helpers`

## Success Criteria

Week 5 is considered complete when:

- ✅ All verification checks pass
- ✅ All tests pass
- ✅ Schema has provider+externalId with unique constraint
- ✅ Adapters write provider+externalId
- ✅ UI has no provider-specific logic
- ✅ API supports provider filtering
- ✅ Demo mode includes multiple providers

## Maintenance

When adding new providers:

1. Add adapter to `src/lib/providers/`
2. Add demo workflows for new provider
3. Update tests if needed
4. Re-run verification: `npm run week5:verify`

The verification system should catch any regressions automatically.
