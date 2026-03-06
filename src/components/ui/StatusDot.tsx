type StatusDotVariant = "success" | "warning" | "error" | "neutral" | "muted";

const variantClasses: Record<StatusDotVariant, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  neutral: "bg-gray-300",
  muted: "bg-gray-300",
};

interface StatusDotProps {
  variant?: StatusDotVariant;
  className?: string;
  pulse?: boolean;
}

export function StatusDot({ variant = "neutral", className = "", pulse = false }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-[5px] h-[5px] shrink-0 rounded-full ${variantClasses[variant]} ${pulse ? "animate-pulse-dot" : ""} ${className}`}
      aria-hidden
    />
  );
}
