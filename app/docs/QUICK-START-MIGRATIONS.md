# Quick Start: Running Migrations

## 🚀 Fast Track (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy and edit .env
cp .env.example .env
# Add your Supabase DIRECT_URL (port 5432) and DATABASE_URL (port 6543)

# 3. Check connection
npm run db:check

# 4. Run migration
npm run db:migrate

# 5. Verify
npm run db:status
```

## 📍 Where to Get Connection Strings

**Supabase Dashboard** → **Project Settings** → **Database** → **Connection string**

- **Connection pooling** (port 6543) → `DATABASE_URL`
- **Direct connection** (port 5432) → `DIRECT_URL`

Both must include: `?sslmode=require`

## ✅ Verification Query

After migration, run this in Supabase SQL Editor:

```sql
-- Check Week 5 columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'Workflow' 
  AND column_name IN ('provider', 'externalId', 'toolWorkflowId')
ORDER BY column_name;

-- Expected:
-- externalId | text | NO | null
-- provider   | text | NO | null  
-- toolWorkflowId | text | YES | null

-- Check unique constraint
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Workflow' 
  AND indexname = 'Workflow_provider_externalId_key';

-- Expected: UNIQUE constraint on (provider, externalId)
```

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `P1001: Can't reach database` | Use `DIRECT_URL` with port 5432, not 6543 |
| `sslmode` error | Add `?sslmode=require` to connection string |
| `column already exists` | Migration partially applied - check status |
| Auth failed | Regenerate password in Supabase Dashboard |

## 📚 Full Documentation

See `docs/PRISMA-SUPABASE-FIX.md` for complete details.
