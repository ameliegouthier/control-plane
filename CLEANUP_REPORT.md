# Codebase Cleanup Report — STEP 1: Unused Files

## 1. Files never imported (safe to remove)

| File | Reason |
|------|--------|
| `src/lib/data-formatters.ts` | No imports found in codebase |
| `src/lib/crypto.ts` | No imports found in codebase |
| `src/lib/n8n-connection.ts` | No imports found in codebase |
| `src/lib/action-engine/issueEngine.demo.ts` | Standalone demo script, not imported |
| `src/types/index.ts` | No file imports from `@/types` |
| `src/types/workflow.ts` | Only used by types/index (unused barrel) |
| `src/types/destination.ts` | Only used by types/index (unused barrel) |
| `src/types/provider.ts` | Only used by types/index (unused barrel) |
| `src/types/system-status.ts` | Only used by types/index (unused barrel) |

## 2. Unused React components

| Component | Reason |
|-----------|--------|
| `src/app/overview/components/TopDomainTabs.tsx` | Never imported anywhere |
| `src/app/overview/components/NeedsAttentionPanel.tsx` | Never imported anywhere |

## 3. Unused pages / routes

| Route | Reason |
|-------|--------|
| `src/app/debug/n8n/page.tsx` | Debug page, not linked from app; keep only overview, workflow detail, connect modal |
| `src/app/health/page.tsx` | Health check page, not linked from app |
| `src/app/destinations/[destination]/page.tsx` | Duplicate route; app links only to `/destination/[slug]` (singular). No link to `/destinations/...` |

## 4. Unused helper (optional)

| Item | Note |
|------|------|
| `getAllDestinationSlugs()` in `src/app/data/destinations.ts` | Exported but never used; can remove to reduce dead code |

## 5. CSS

- All CSS under `src/styles/` is used: `index.css` → layout; `fonts.css` and `theme.css` → imported by `index.css`.

## 6. Routes to keep

- `/` — root (Dashboard)
- `/overview` — overview page (linked from workflow detail and destination pages)
- `/workflows/[id]` — workflow detail (linked from overview, destination, etc.)
- `/destination/[slug]` — destination detail (linked from SystemMap)
- Connect provider modal — component used by dashboard and overview (not a route)

## 7. Debug / temporary code (STEP 5)

- `console.log` / `console.warn` / `console.error` in: `page.tsx`, `dashboard.tsx`, `n8n-client.ts`, `api/workflows/route.ts`, `api/connections/n8n/route.ts`, `issueEngine.demo.ts` (file will be removed).
- TODOs to keep (auth/API placeholders): in `api/workflows/route.ts`, `lib/demo-user.ts`, `lib/providers/make-adapter.ts`.
