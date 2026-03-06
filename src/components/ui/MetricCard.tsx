import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  valueClassName = "text-gray-900",
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`bg-white rounded-lg px-4 py-3.5 hover:shadow-sm transition-all duration-150 cursor-default ${className}`}
      style={{ border: '1px solid rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] tracking-wide text-gray-400 uppercase">{title}</span>
        {icon != null && <span className="text-gray-500">{icon}</span>}
      </div>
      <div className={`text-[22px] tracking-tight mb-0.5 ${valueClassName}`} style={{ lineHeight: 1.2 }}>
        {value}
      </div>
      <div className="text-[11px] text-gray-400">{description}</div>
    </div>
  );
}
