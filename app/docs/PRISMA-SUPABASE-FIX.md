# Prisma + Supabase Connection Fix - Report

## 🔍 Audit Results

### What Was Checked

1. **Prisma Schema (`prisma/schema.prisma`)**
   - ❌ Missing `directUrl` configuration
   - ✅ Correct provider (postgresql)
   - ✅ DATABASE_URL env var configured

2. **Environment Variables**
   - ❌ No `.env.example` file
   - ⚠️  No `DIRECT_URL` documented
   - ⚠️  SSL mode not explicitly required in docs

3. **Migration Files**
   - ✅ Week 5 migration exists: `20260220113123_add_provider_and_external_id_to_workflow`
   - ⚠️  Migration SQL could fail on empty tables (UPDATE with JOIN)
   - ✅ Migration structure is correct

4. **Package.json Scripts**
   - ❌ No database connectivity check script
   - ❌ No dedicated migration scripts
   - ✅ Prisma generate in postinstall/build

5. **Connection Configuration**
   - ❌ No direct connection URL (required for Supabase migrations)
   - ❌ No SSL mode enforcement
   - ⚠️  No connectivity validation

### What Was Wrong

1. **Missing `directUrl` in schema.prisma**
   - Supabase uses connection pooling (PgBouncer) on port 6543 for runtime
   - Migrations require direct connection on port 5432
   - Prisma needs both URLs configured

2. **No connectivity check**
   - P1001 errors were cryptic
   - No way to validate connection before running migrations
   - No troubleshooting guidance

3. **Migration SQL safety**
   - UPDATE with JOIN could fail if no workflows exist
   - No fallback for orphaned workflows (missing connection)

4. **Missing documentation**
   - No `.env.example` template
   - No instructions on where to get Supabase connection strings
   - No clear distinction between pooled vs direct connections

## ✅ What Was Changed

### 1. Updated `prisma/schema.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Connection pooling URL (PgBouncer) for runtime
  directUrl = env("DIRECT_URL")       // Direct connection (port 5432) for migrations
}
```

**Impact**: Prisma will use `DIRECT_URL` for migrations, `DATABASE_URL` for runtime queries.

### 2. Created `.env.example`

Added template with:
- `DATABASE_URL` (pooled, port 6543) - for runtime
- `DIRECT_URL` (direct, port 5432) - for migrations
- Clear instructions on where to get these from Supabase Dashboard
- SSL mode requirement documented

### 3. Created `scripts/db-check.ts`

Automated connectivity check script that validates:
- Environment variables are set
- SSL mode is included
- Ports are correct (6543 for pooled, 5432 for direct)
- DNS resolution works
- Prisma can connect

**Usage**: `npm run db:check`

### 4. Updated `package.json` Scripts

Added database management scripts:
- `db:check` - Connectivity check
- `db:migrate` - Local migration (dev)
- `db:deploy` - Production migration (deploy)
- `db:generate` - Generate Prisma client
- `db:studio` - Open Prisma Studio
- `db:status` - Check migration status

### 5. Fixed Migration SQL

Updated `20260220113123_add_provider_and_external_id_to_workflow/migration.sql`:
- Added `COALESCE` for safer NULL handling
- Added fallback UPDATE for orphaned workflows
- Safe for empty tables

### 6. Added `tsx` Dependency

Required for running TypeScript scripts (`db-check.ts`).

## 📋 Exact Commands to Run

### Local Setup

```bash
# 1. Install dependencies (includes tsx)
npm install

# 2. Set up .env file
cp .env.example .env
# Edit .env and add your Supabase connection strings:
# - DATABASE_URL (pooled, port 6543)
# - DIRECT_URL (direct, port 5432)

# 3. Check connectivity
npm run db:check

# 4. Run migrations
npm run db:migrate

# 5. Generate Prisma client
npm run db:generate

# 6. Verify migration (optional)
npm run db:status
```

### Production (Vercel)

```bash
# In Vercel dashboard or CLI:
# 1. Set environment variables:
#    - DATABASE_URL (pooled connection)
#    - DIRECT_URL (direct connection)

# 2. Run migration deploy
npm run db:deploy

# Or in Vercel build command:
# "build": "prisma generate && prisma migrate deploy && next build"
```

## 🔧 Where to Get Supabase Connection Strings

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Project Settings** → **Database**
3. Scroll to **Connection string** section
4. Copy:
   - **Connection pooling** → Use for `DATABASE_URL` (port 6543)
   - **Direct connection** → Use for `DIRECT_URL` (port 5432)
5. Both should include `?sslmode=require` at the end

**Example format:**
```
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require"
```

## ✅ Validation Checklist

After running migrations, verify:

```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Workflow' 
  AND column_name IN ('provider', 'externalId', 'toolWorkflowId');

-- Check unique constraint exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Workflow' 
  AND indexname LIKE '%provider_externalId%';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Workflow' 
  AND indexname LIKE '%provider%';
```

Expected results:
- `provider`: TEXT, NOT NULL ✅
- `externalId`: TEXT, NOT NULL ✅
- `toolWorkflowId`: TEXT, NULLABLE ✅
- Unique constraint: `Workflow_provider_externalId_key` ✅
- Index: `Workflow_provider_idx` ✅

## 🚨 Troubleshooting

### P1001: Can't reach database server

**Causes:**
- Wrong `DIRECT_URL` (using pooled port 6543 instead of 5432)
- Missing `sslmode=require`
- Firewall blocking connection
- Supabase project paused

**Fix:**
1. Run `npm run db:check` for detailed diagnostics
2. Verify `DIRECT_URL` uses port 5432
3. Ensure `?sslmode=require` is in connection string
4. Check Supabase project is active

### Migration fails with "column already exists"

**Cause:** Migration was partially applied

**Fix:**
```bash
# Check migration status
npm run db:status

# If needed, mark migration as applied manually
# (only if columns already exist)
```

### Authentication failed (P1000)

**Cause:** Wrong password or user permissions

**Fix:**
1. Regenerate database password in Supabase Dashboard
2. Update `DIRECT_URL` with new password
3. Ensure user has migration permissions

## 📝 Notes

- **Demo mode preserved**: `DEMO_MODE=true` still works, skips DB entirely
- **Backward compatible**: Existing `DATABASE_URL` usage unchanged
- **Minimal changes**: Only added `directUrl`, no breaking changes
- **Reliability prioritized**: Connectivity checks prevent cryptic errors

## 🎯 Next Steps

1. ✅ Copy `.env.example` to `.env` and fill in Supabase credentials
2. ✅ Run `npm install` to get `tsx` dependency
3. ✅ Run `npm run db:check` to validate connection
4. ✅ Run `npm run db:migrate` to apply Week 5 migration
5. ✅ Verify migration with `npm run db:status`
6. ✅ Test application with new schema

All changes are backward compatible and don't break demo mode.
