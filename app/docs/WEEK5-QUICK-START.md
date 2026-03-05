# Week 5 Verification - Quick Start

## 🚀 Run Verification (One Command)

```bash
npm run week5:verify
```

This runs all checks and tests, then reports PASS/FAIL.

## 📋 What It Checks

1. **Schema** - provider/externalId fields, unique constraint, migration
2. **Adapters** - n8n/make adapters write provider+externalId correctly
3. **UI** - No provider-specific code in client components
4. **API** - Provider filtering works, legacy params supported
5. **Demo** - Multiple providers in demo mode

## ✅ Expected Output

```
🔍 Week 5 Verification Report
============================================================
✅ All checks pass
✅ Week 5 verification PASSED!
```

## 🐛 If It Fails

1. Read the error messages (they're specific)
2. Run individual tests: `npm test -- week5-schema`
3. Check the full report in `docs/WEEK5-VERIFICATION.md`

## 📚 Full Documentation

- **Verification Plan**: `docs/WEEK5-VERIFICATION.md`
- **Summary**: `docs/WEEK5-VERIFICATION-SUMMARY.md`

## 🎯 Success = Week 5 Complete

When `npm run week5:verify` passes, Week 5 is verified and complete!
