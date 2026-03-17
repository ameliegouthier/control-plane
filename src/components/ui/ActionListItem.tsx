import type { ReactNode } from "react";
import Link from "next/link";

interface ActionListItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  variant?: "urgent" | "optimization" | "default";
  onClick?: () => void;
}

const VARIANT_CONFIG: Record<
  NonNullable<ActionListItemProps["variant"]>,
  { iconBg: string; iconText: string; iconBorder: string }
> = {
  urgent: {
    iconBg: "bg-red-50",
    iconText: "text-red-600",
    iconBorder: "border-red-100",
  },
  optimization: {
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    iconBorder: "border-amber-100",
  },
  default: {
    iconBg: "bg-muted",
    iconText: "text-muted-foreground",
    iconBorder: "border-border",
  },
};

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function ActionListItem({
  icon,
  title,
  description,
  href,
  variant = "default",
  onClick,
}: ActionListItemProps) {
  const { iconBg, iconText, iconBorder } = VARIANT_CONFIG[variant];

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-3 bg-card rounded-lg hover:bg-accent/60 transition-all duration-150 cursor-pointer group"
      style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      onClick={onClick}
    >
      <div
        className={`w-7 h-7 rounded-md ${iconBg} ${iconText} flex items-center justify-center shrink-0 border ${iconBorder}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{description}</div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </Link>
  );
}
