const DASHBOARD_SCROLL_KEY = "dashboardScroll";

/**
 * Store current scroll position before navigating away from the dashboard.
 * Call this when the user clicks a link to a workflow detail page.
 */
export function saveDashboardScroll(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DASHBOARD_SCROLL_KEY, String(window.scrollY));
}

/**
 * Read saved scroll position (for restoring on dashboard mount).
 * Returns null if none saved or invalid.
 */
export function getDashboardScroll(): number | null {
  if (typeof window === "undefined") return null;
  const saved = sessionStorage.getItem(DASHBOARD_SCROLL_KEY);
  if (saved == null) return null;
  const n = Number(saved);
  return Number.isFinite(n) ? n : null;
}

/**
 * Clear saved scroll after restoring, so we don't restore on later visits.
 */
export function clearDashboardScroll(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DASHBOARD_SCROLL_KEY);
}
