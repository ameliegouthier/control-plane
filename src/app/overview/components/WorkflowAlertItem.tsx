import Link from "next/link";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";

export type AlertVariant = "broken" | "warning" | "duplicate";

interface WorkflowAlertItemProps {
  variant: AlertVariant;
  title: string;
  subtitle: string;
  actionLabel: string;
  href: string;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { badge: string; badgeLabel: string; card: string }
> = {
  broken: {
    badge: "bg-destructive text-destructive-foreground",
    badgeLabel: "Broken",
    card: "bg-destructive/10 border-destructive/30",
  },
  warning: {
    badge: "bg-warning text-warning-foreground",
    badgeLabel: "Warning",
    card: "bg-warning/10 border-warning/30",
  },
  duplicate: {
    badge: "bg-warning text-warning-foreground",
    badgeLabel: "Duplicate?",
    card: "bg-warning/10 border-warning/30",
  },
};

export default function WorkflowAlertItem({
  variant,
  title,
  subtitle,
  actionLabel,
  href,
}: WorkflowAlertItemProps) {
  const { badge, badgeLabel, card } = VARIANT_CONFIG[variant];

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${card}`}>
      <span
        className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold leading-tight ${badge}`}
      >
        {badgeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {title}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        onClick={saveDashboardScroll}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
