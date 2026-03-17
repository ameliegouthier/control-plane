import type { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  submessage?: string;
  variant?: "default" | "success" | "info";
}

function DefaultIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const VARIANT_CONFIG: Record<
  NonNullable<EmptyStateProps["variant"]>,
  { icon: (props: { className?: string }) => ReactNode; iconClass: string }
> = {
  default: { icon: DefaultIcon, iconClass: "text-muted-foreground" },
  success: { icon: SuccessIcon, iconClass: "text-success" },
  info: { icon: InfoIcon, iconClass: "text-primary" },
};

export function EmptyState({ message, submessage, variant = "default" }: EmptyStateProps) {
  const { icon: Icon, iconClass } = VARIANT_CONFIG[variant];

  return (
    <div className="bg-muted rounded-xl px-6 py-10 text-center" style={{ border: "1px solid var(--border)" }}>
      <Icon className={`w-8 h-8 mx-auto mb-3 ${iconClass}`} />
      <p className="text-[13px] text-foreground">{message}</p>
      {submessage && (
        <p className="mt-1 text-[11px] text-muted-foreground">{submessage}</p>
      )}
    </div>
  );
}
