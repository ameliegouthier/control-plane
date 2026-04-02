/**
 * AlertBanner — horizontal strip with colored left border, dot indicator,
 * title + subtitle, and an optional action button.
 *
 * variant="banner"  → solid light-red bg, 3px left border (used in OverviewClient top alert)
 * variant="row"     → red-50 bg, 2px left border, white action button (used in UrgentSignalsBanner)
 */

interface AlertBannerProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "banner" | "row";
}

export function AlertBanner({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = "row",
}: AlertBannerProps) {
  if (variant === "banner") {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: "#fff5f5",
          borderLeft: "3px solid #ef4444",
          borderTop: "0.5px solid #fecaca",
          borderRight: "0.5px solid #fecaca",
          borderBottom: "0.5px solid #fecaca",
        }}
      >
        <span
          className="shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: "#DC2626" }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium" style={{ color: "#791F1F" }}>{title}</div>
          {subtitle && (
            <div className="text-[11px] mt-0.5" style={{ color: "#A32D2D" }}>{subtitle}</div>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#b91c1c",
              background: "#fee2e2",
              padding: "5px 10px",
              borderRadius: "6px",
              border: "0.5px solid #fca5a5",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  // variant="row"
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-50 border-t border-r border-b border-red-100 mb-2"
      style={{ borderLeft: "2px solid #f87171" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        <div>
          <div className="text-[12px] font-medium text-red-800">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-red-600 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
