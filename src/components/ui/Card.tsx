import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  clickable?: boolean;
}

export function Card({ children, className = "", clickable = false }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl transition-all duration-200 ${clickable ? "cursor-pointer hover:shadow-md group" : "cursor-default hover:shadow-sm"} ${className}`}
      style={{ border: '1px solid rgba(0,0,0,0.07)' }}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`px-5 pt-5 pb-3 ${className}`}
    >
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}
