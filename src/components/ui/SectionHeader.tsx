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
        <div className={`w-1 h-3.5 rounded-full ${accent}`} />
        <span className="text-[11px] tracking-[0.08em] uppercase text-gray-400">
          {title}
        </span>
      </div>
      <div className="flex-1 h-px bg-gray-100" />
      {count != null && (
        <span className="text-[11px] text-gray-400">{count}</span>
      )}
      {children}
    </div>
  );
}
