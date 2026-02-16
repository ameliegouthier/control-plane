/**
 * Demo mode for MVP unblocker.
 *
 * Persists a boolean flag in localStorage so demo mode survives page reloads.
 * Safe to call during SSR (returns false when window is unavailable).
 */

const STORAGE_KEY = "controlPlane.demoMode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function enableDemoMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Storage full or blocked — ignore in MVP
  }
}

export function disableDemoMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
