import type { ReactNode } from "react";

export type StatusBadgeVariant = "blue" | "success" | "warning" | "error" | "neutral";

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  blue:    "bg-blue-50    text-blue-700    border-blue-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50   text-amber-700   border-amber-100",
  error:   "bg-orange-50  text-orange-700  border-orange-100",
  neutral: "bg-gray-100   text-gray-500    border-gray-200",
};

interface StatusBadgeProps {
  children: ReactNode;
  variant: StatusBadgeVariant;
  className?: string;
}

export function StatusBadge({ children, variant, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
