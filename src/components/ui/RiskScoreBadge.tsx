interface RiskScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

type RiskLevel = "high" | "medium" | "low";

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; bg: string; text: string; border: string }
> = {
  high: {
    label: "High risk",
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/20",
  },
  medium: {
    label: "Medium risk",
    bg: "bg-warning/10",
    text: "text-warning-foreground",
    border: "border-warning/20",
  },
  low: {
    label: "Low risk",
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/20",
  },
};

export function RiskScoreBadge({ score, size = "sm" }: RiskScoreBadgeProps) {
  const level = getRiskLevel(score);
  const { label, bg, text, border } = RISK_CONFIG[level];

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-[2px] rounded-full border font-medium ${bg} ${text} ${border}`}
      >
        {score}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center justify-center w-14 h-14 rounded-lg border ${bg} ${border}`}
    >
      <span className={`text-[18px] font-semibold leading-none ${text}`}>{score}</span>
      <span className={`text-[9px] mt-0.5 ${text} opacity-80`}>{label}</span>
    </div>
  );
}
