# Fix Prisma + Supabase Connection & Week 5 Migration

## 🎯 Goal

Make Prisma + Supabase DB connection and migration workflow rock-solid (local + Vercel), and ensure Week 5 migration can be applied successfully.

## 🔍 What Was Audited

### ✅ Prisma Configuration
- **Schema**: Missing `directUrl` for Supabase migrations
- **Migrations**: Week 5 migration exists but SQL could fail on edge cases
- **Scripts**: No connectivity checks or dedicated migration commands

### ✅ Environment Setup
- **.env.example**: Missing (no template for new developers)
- **Connection strings**: No distinction between pooled vs direct connections
- **SSL mode**: Not documented as required

### ✅ Connection Issues
- **P1001 errors**: Caused by using pooled connection (port 6543) for migrations
- **No validation**: No way to check connectivity before running migrations
- **Cryptic errors**: No troubleshooting guidance

## 🔧 What Was Fixed

### 1. Prisma Schema (`prisma/schema.prisma`)
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled (port 6543) for runtime
  directUrl = env("DIRECT_URL")       // Direct (port 5432) for migrations
}
```

**Why**: Supabase requires direct connections (port 5432) for migrations, but pooled connections (port 6543) for runtime queries.

### 2. Environment Template (`.env.example`)
- Added `DATABASE_URL` template (pooled connection)
- Added `DIRECT_URL` template (direct connection)
- Clear instructions on where to get these from Supabase Dashboard
- SSL mode requirement documented

### 3. Connectivity Check Script (`scripts/db-check.ts`)
Automated script that validates:
- ✅ Environment variables are set
- ✅ SSL mode is included (`sslmode=require`)
- ✅ Ports are correct (6543 pooled, 5432 direct)
- ✅ DNS resolution works
- ✅ Prisma can connect

**Usage**: `npm run db:check`

### 4. Database Scripts (`package.json`)
Added:
- `db:check` - Connectivity validation
- `db:migrate` - Local migration (dev)
- `db:deploy` - Production migration (deploy)
- `db:generate` - Generate Prisma client
- `db:studio` - Open Prisma Studio
- `db:status` - Check migration status

### 5. Migration SQL Safety (`prisma/migrations/.../migration.sql`)
- Added `COALESCE` for safer NULL handling
- Added fallback UPDATE for orphaned workflows
- Safe for empty tables (no failures if no data exists)

### 6. Dependencies
- Added `tsx` for running TypeScript scripts

## 📋 Exact Commands to Run

### Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up .env
cp .env.example .env
# Edit .env: Add DATABASE_URL (port 6543) and DIRECT_URL (port 5432)

# 3. Check connectivity
npm run db:check

# 4. Run migration
npm run db:migrate

# 5. Generate client
npm run db:generate

# 6. Verify (optional)
npm run db:status
```

### Production (Vercel)
```bash
# Set env vars in Vercel dashboard:
# - DATABASE_URL (pooled)
# - DIRECT_URL (direct)

# Run migration deploy
npm run db:deploy
```

## 📍 Where to Get Supabase Connection Strings

1. **Supabase Dashboard** → Your Project
2. **Project Settings** → **Database**
3. **Connection string** section:
   - **Connection pooling** (port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DIRECT_URL`
4. Both must include: `?sslmode=require`

## ✅ Validation

After migration, verify in Supabase SQL Editor:

```sql
-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Workflow' 
  AND column_name IN ('provider', 'externalId', 'toolWorkflowId');

-- Expected:
-- provider: TEXT, NOT NULL ✅
-- externalId: TEXT, NOT NULL ✅
-- toolWorkflowId: TEXT, NULLABLE ✅

-- Check unique constraint
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Workflow' 
  AND indexname = 'Workflow_provider_externalId_key';
-- Expected: exists ✅
```

## 🚨 Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `P1001: Can't reach database` | Wrong port (using 6543) | Use `DIRECT_URL` with port 5432 |
| SSL error | Missing `sslmode=require` | Add `?sslmode=require` to connection string |
| `column already exists` | Partial migration | Check status: `npm run db:status` |
| Auth failed | Wrong password | Regenerate in Supabase Dashboard |

## ✅ Backward Compatibility

- ✅ Demo mode preserved (`DEMO_MODE=true` still works)
- ✅ Existing `DATABASE_URL` usage unchanged
- ✅ No breaking changes to application code
- ✅ Legacy `toolWorkflowId` still supported

## 📚 Documentation

- **Full report**: `docs/PRISMA-SUPABASE-FIX.md`
- **Quick start**: `docs/QUICK-START-MIGRATIONS.md`
- **Test plan**: `docs/week5-tests.md`

## 🎯 Testing Checklist

- [ ] Run `npm run db:check` - should pass
- [ ] Run `npm run db:migrate` - should apply Week 5 migration
- [ ] Verify columns exist in Supabase SQL Editor
- [ ] Verify unique constraint exists
- [ ] Test application with new schema
- [ ] Verify demo mode still works

---

**Impact**: Zero breaking changes, improved reliability, better developer experience.
