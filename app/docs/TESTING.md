# Testing Guide

## Quick Start

```bash
# Install dependencies (includes Vitest)
npm install

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- workflow-helpers

# Run with coverage
npm test -- --coverage
```

## Test Structure

Tests are located alongside source code in `__tests__` directories:

- `src/lib/__tests__/` - Library tests (migration logic)
- `src/lib/providers/__tests__/` - Provider adapter tests
- `src/app/__tests__/` - App-level tests (workflow helpers, UI guards)
- `src/app/api/__tests__/` - API route tests

## Test Categories

### 1. Migration Logic Tests
**File**: `src/lib/__tests__/migration.test.ts`

Tests backward compatibility: workflows without `provider`/`externalId` derive values from `Connection.tool` and `toolWorkflowId`.

### 2. N8N Adapter Upsert Tests
**File**: `src/lib/providers/__tests__/n8n-adapter-upsert.test.ts`

Tests the three-tier upsert logic:
- New world: update by `(provider, externalId)`
- Migration: update by `(connectionId, toolWorkflowId)` and populate new fields
- Create: no match → create new workflow

### 3. Workflow Helpers Tests
**File**: `src/app/__tests__/workflow-helpers.test.ts`

Tests `toWorkflow()` function:
- Provider field handling (new vs legacy)
- External ID handling (new vs legacy)
- Graph normalization (new vs legacy formats)

### 4. API Route Tests
**File**: `src/app/api/__tests__/workflows-route.test.ts`

Tests `/api/workflows` filtering:
- `?provider=n8n` filtering
- `?tool=N8N` legacy filtering
- Precedence when both params provided
- Connection ID filtering

### 5. UI Provider-Agnostic Guard Tests
**File**: `src/app/__tests__/ui-provider-agnostic.test.ts`

Prevents provider-specific logic in UI:
- No n8n adapter/client imports in client components
- No direct access to `actions.nodes`/`actions.connections`
- Type safety checks

## Mocking Strategy

- **Prisma**: Mocked via `vi.mock('@/lib/prisma')` - no real database needed
- **n8n API**: Mocked via `vi.mock('@/lib/n8n-client')` - no real n8n server needed
- **External APIs**: All external calls are mocked

## Writing New Tests

1. Create test file: `src/**/__tests__/your-feature.test.ts`
2. Import Vitest: `import { describe, it, expect, vi } from "vitest"`
3. Mock dependencies: `vi.mock('@/lib/dependency')`
4. Write tests following existing patterns

## CI/CD Integration

Tests run automatically in CI. To run locally before pushing:

```bash
npm test
```

## Troubleshooting

**Tests fail with "Cannot find module"**
- Run `npm install` to ensure all dependencies are installed
- Run `npx prisma generate` if Prisma types are missing

**Mock not working**
- Ensure `vi.mock()` is called before imports
- Check that mock path matches actual import path

**Type errors in tests**
- Ensure `vitest.config.ts` has correct path aliases
- Check that `tsconfig.json` includes test files
