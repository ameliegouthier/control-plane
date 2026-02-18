import Link from "next/link";

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
    badge: "bg-red-500 text-white",
    badgeLabel: "Broken",
    card: "bg-red-50/40 border-red-100",
  },
  warning: {
    badge: "bg-amber-400 text-amber-950",
    badgeLabel: "Warning",
    card: "bg-amber-50/40 border-amber-100",
  },
  duplicate: {
    badge: "bg-orange-400 text-white",
    badgeLabel: "Duplicate?",
    card: "bg-orange-50/40 border-orange-100",
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
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-800">
          {title}
        </p>
        <p className="mt-1 text-xs leading-snug text-zinc-400">{subtitle}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-zinc-400 transition hover:text-zinc-700"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
