/**
 * Shared data formatting utilities for the dashboard.
 */

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCount(value: number): string {
  return String(value);
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "Never";
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoDate);
  } catch {
    return "—";
  }
}
