# Styling audit & design system refactor

## 1. Audit summary (issues found and locations)

### Hardcoded colors (now resolved)

| Location | Previous | Now |
|----------|----------|-----|
| **dashboard.tsx** | `bg-white`, `bg-zinc-50`, `border-zinc-200`, `text-zinc-900`, `bg-indigo-600`, `text-white`, `bg-amber-50`, `text-amber-700`, `bg-emerald-100`, `bg-red-50`, `text-red-600`, etc. | `bg-background`, `bg-surface-sidebar`, `bg-card`, `border-border`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-warning/10`, `text-warning`, `bg-success/15`, `bg-destructive/10`, `text-destructive` |
| **overview/page.tsx** | `bg-[#fafafa]`, `text-neutral-900`, `border-neutral-200`, `bg-white`, `bg-neutral-900`, `text-white`, `bg-neutral-800` | `bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-primary`, `text-primary-foreground` |
| **connect-provider-modal.tsx** | `bg-black/40`, `border-zinc-200`, `bg-white`, `text-zinc-900`, `bg-indigo-100`, `focus:border-indigo-300`, `border-red-200`, `bg-red-50`, `text-red-600`, `bg-emerald-50`, `text-emerald-700` | `bg-foreground/40`, `border-border`, `bg-card`, `text-foreground`, `bg-primary/10`, `focus:border-ring`, `focus:ring-ring`, `border-destructive/40`, `bg-destructive/10`, `text-destructive`, `bg-success/10`, `text-success` |
| **overview/components/** (NeedsAttentionPanel, SystemMap, WorkflowAlertItem, WorkflowList, ActionCenter, SidebarTools, KpiCards, TopDomainTabs) | Various `neutral-*`, `zinc-*`, `red-*`, `amber-*`, `emerald-*`, `indigo-*`, `orange-*`, `violet-*` | `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-destructive`, `bg-warning`, `bg-success`, `bg-primary`, `bg-muted`, etc. |
| **workflows/[id]/page.tsx** | Same patterns as dashboard | Same token replacements |
| **destinations/[destination]/page.tsx** | `border-zinc-200`, `bg-white`, `text-zinc-*` | `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground` |
| **destination/[slug]/page.tsx** | `border-amber-200`, `bg-amber-50`, `text-neutral-*`, `bg-[#fafafa]`, `bg-orange-500`, `bg-neutral-200` | Category styles use `border-warning/40`, `bg-warning/10`, `bg-muted`, `bg-background`, `bg-warning`, `bg-success`, `bg-muted` |
| **debug/n8n/page.tsx** | `bg-zinc-50`, `dark:bg-zinc-950`, `text-zinc-900`, `border-zinc-200`, `bg-white`, `text-zinc-800`, `text-red-600` | `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-destructive` |
| **components/ui/Badge.tsx** | `bg-neutral-100`, `text-neutral-700`, `bg-emerald-100`, `bg-amber-100`, `bg-red-100` | `bg-muted`, `text-muted-foreground`, `bg-success/15`, `text-success`, `bg-warning/15`, `bg-destructive/15`, `text-destructive` |
| **components/ui/StatusDot.tsx** | `bg-emerald-500`, `bg-amber-500`, `bg-red-500`, `bg-neutral-400`, `bg-neutral-300` | `bg-success`, `bg-warning`, `bg-destructive`, `bg-muted-foreground` |
| **components/ui/MetricCard.tsx** | `border-neutral-200`, `bg-white`, `text-neutral-900`, `text-neutral-400`, `text-neutral-500` | `border-border`, `bg-card`, `text-foreground`, `text-muted-foreground` |
| **components/ui/SectionHeader.tsx** | `bg-neutral-300`, `text-neutral-500` | `bg-border`, `text-muted-foreground` |

### Inline styles (resolved)

| Location | Issue | Resolution |
|----------|--------|------------|
| **health/page.tsx** | `style={{ padding: 40, fontFamily: "sans-serif" }}`, `style={{ color: "green", fontWeight: "bold" }}` | Replaced with Tailwind: `className="p-10 font-sans"`, `className="text-success font-bold"` |
| **SidebarTools.tsx** (MakeIcon SVG) | `style={{ maskType: "luminance" }}` on `<mask>` | Left as-is: required for SVG mask behavior; not a presentational override. |

### CSS / theme

- **index.css** previously re-set `background`, `color`, and `font-family` on `html, body`, duplicating theme.css base layer. Removed duplicate; theme.css remains the source of truth; layout applies font via `next/font` on `<body>`.

### Font usage

- **layout.tsx**: Uses `next/font` (Inter) and applies `inter.className` to `<body>`.
- **fonts.css**: Defines `--font-inter` for use in theme.
- **theme.css**: Uses `--font-sans: var(--font-inter), ...` in `@theme inline` and in base `html { font-family: var(--font-sans) }`.
- No duplicated font definitions: Next.js font is the source for body; CSS variables used for consistency elsewhere.

---

## 2. Standardization on theme tokens

All listed components now use design tokens from `theme.css`:

- **Surfaces**: `bg-background`, `bg-card`, `bg-muted`, `bg-accent`, `bg-surface-sidebar`
- **Text**: `text-foreground`, `text-muted-foreground`, `text-primary`, `text-primary-foreground`
- **Borders**: `border-border`
- **Status**: `bg-destructive`, `text-destructive`, `bg-success`, `text-success`, `bg-warning`, `text-warning`
- **Focus**: `focus:border-ring`, `focus:ring-ring`

---

## 3. UI primitive layer

Added in **theme.css** (semantic aliases; existing tokens unchanged):

**Surface primitives**

- `--surface-page` → `var(--background)`
- `--surface-card` → `var(--card)`
- `--surface-elevated` → `var(--popover)`
- `--surface-sidebar` → `var(--sidebar)`
- `--surface-muted` → `var(--muted)`

**Text primitives**

- `--text-primary` → `var(--foreground)`
- `--text-secondary` → `var(--muted-foreground)`
- `--text-muted` → `var(--muted-foreground)`

**Border primitives**

- `--border-default` → `var(--border)`
- `--border-subtle` → `var(--border)`

**Semantic status (new tokens)**

- `--success`, `--success-foreground`
- `--warning`, `--warning-foreground`  
(Destructive already existed.)

All of the above are mapped in `@theme inline` so Tailwind utilities (e.g. `bg-surface-page`, `text-text-primary`, `border-border-default`, `bg-success`, `text-warning`) work as expected.

---

## 4. Tailwind mapping

- **theme.css** `@theme inline` block maps every design token to Tailwind `--color-*` and `--radius-*`.
- New primitives and status colors are included.
- Components use only token-based utilities; no hardcoded Tailwind color scales (e.g. no `bg-white`, `text-zinc-600`).

---

## 5. Clean styling conflicts

- Removed duplicate `html, body` rules from **index.css** (base styles live in theme.css).
- Replaced all remaining hardcoded color utilities with tokens.
- No legacy Tailwind color overrides left in components.

---

## 6. Typography consistency

- **Next.js**: `layout.tsx` loads Inter via `next/font` and applies it to `<body>`.
- **CSS**: `--font-sans` in theme uses `var(--font-inter)` from fonts.css; theme base sets `font-family` on `html`.
- Single effective font stack; no conflicting or duplicated font definitions.

---

## 7. Functionality preserved

- No component logic or layout structure was changed.
- Only class names and the health page inline styles were updated; behavior and structure are unchanged.

---

## Result

- All components use design tokens from **theme.css**.
- No hardcoded palette colors remain in components.
- UI uses semantic primitives (surface, text, border) and status tokens (success, warning, destructive).
- **theme.css** is the single source of truth; Tailwind is fed via `@theme inline`.
- The codebase is ready to maintain, extend, and generate UI from (e.g. with AI tools) in a consistent way.
