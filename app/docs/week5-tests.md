# Week 5 Multi-Provider Architecture - Test Plan

## Overview

This test plan validates the Week 5 hardening changes that make the architecture fully provider-agnostic. Tests cover both **new world** (provider+externalId) and **legacy world** (toolWorkflowId, connection.tool) scenarios.

## Test Framework

- **Framework**: Vitest (fast, TypeScript-native, ESM support)
- **Location**: `src/**/*.test.ts`
- **Mocking**: `vi.mock()` for Prisma and external APIs
- **No real n8n server required**: All external calls mocked

## Test Categories

### 1. Migration Logic Tests
**File**: `src/lib/__tests__/migration.test.ts`

Validates that workflows created pre-migration are correctly populated with `provider` and `externalId`:

- ✅ Legacy workflow (no provider/externalId) → derives provider from Connection.tool, uses toolWorkflowId as externalId
- ✅ Migration SQL logic: UPDATE statement correctly maps ToolType → provider string
- ✅ Edge cases: missing connection, invalid tool type

### 2. N8N Adapter Upsert Tests
**File**: `src/lib/providers/__tests__/n8n-adapter-upsert.test.ts`

Validates the three-tier upsert logic:

- ✅ **New world**: Workflow exists by `(provider, externalId)` → updates it
- ✅ **Migration**: Workflow exists by `(connectionId, toolWorkflowId)` → updates AND populates provider/externalId
- ✅ **Create**: No match → creates new workflow with all fields
- ✅ Concurrency: Multiple syncs don't create duplicates
- ✅ Provider consistency: provider matches connection.tool

### 3. Workflow Helpers Tests
**File**: `src/app/__tests__/workflow-helpers.test.ts`

Validates `toWorkflow()` backward compatibility:

- ✅ **New world**: Uses `workflow.provider` when present
- ✅ **Legacy**: Falls back to `connection.tool` when provider missing
- ✅ **New world**: Uses `externalId` when present
- ✅ **Legacy**: Falls back to `toolWorkflowId` when externalId missing
- ✅ Graph normalization works for both new and legacy formats

### 4. API Route Filtering Tests
**File**: `src/app/api/__tests__/workflows-route.test.ts`

Validates `/api/workflows` filtering behavior:

- ✅ `?provider=n8n` returns only n8n workflows
- ✅ `?tool=N8N` (legacy) returns same set as `?provider=n8n`
- ✅ **Precedence**: `?provider=n8n&tool=MAKE` → provider wins (provider preferred)
- ✅ `?connectionId=xxx` filters by connection
- ✅ Combined filters work correctly

### 5. UI Provider-Agnostic Guard Tests
**File**: `src/app/__tests__/ui-provider-agnostic.test.ts`

Prevents provider-specific logic from leaking into UI:

- ✅ No imports of `n8n-adapter` or `n8n-client` in UI components
- ✅ UI components only use generic `Workflow` type
- ✅ No direct access to `actions.nodes` or `actions.connections` in UI
- ✅ TypeScript compilation fails if provider-specific types leak

## Running Tests

```bash
# Install dependencies (includes Vitest)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- workflow-helpers

# Run with coverage
npm test -- --coverage
```

## Test Data Strategy

- **Mock Prisma**: Use `vi.mock('@/lib/prisma')` to avoid real DB
- **Mock n8n API**: Mock `fetchN8nApi` to return fake workflow data
- **Test fixtures**: Create minimal valid workflow/connection objects
- **Isolation**: Each test cleans up mocks between runs

## Success Criteria

All tests must pass to consider Week 5 complete:

- ✅ 100% backward compatibility: legacy workflows work without migration
- ✅ New workflows always have provider+externalId
- ✅ No provider-specific logic in UI layer
- ✅ API routes support both new and legacy query params
- ✅ Migration path is safe and reversible
