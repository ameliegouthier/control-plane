import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  accent?: string;
  count?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  accent = "bg-gray-300",
  count,
  children,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 mb-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`w-[3px] h-[14px] rounded-sm flex-shrink-0 ${accent}`} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
          {title}
        </span>
        {count != null && (
          <span className="text-[11px] text-gray-400">{count}</span>
        )}
      </div>
      <div className="flex-1 h-px bg-gray-100" />
      {children}
    </div>
  );
}
