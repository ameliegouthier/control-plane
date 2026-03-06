import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-50 text-gray-500 border-gray-100",
  success: "bg-emerald-50 text-emerald-600 border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  error: "bg-red-50 text-red-600 border-red-100",
  neutral: "bg-gray-50 text-gray-500 border-gray-100",
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
