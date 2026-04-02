import type { Signal } from "@/lib/signals/types";
import { SIGNAL_META } from "@/lib/signals/signalMeta";
import { AlertBanner } from "@/components/ui";

interface UrgentSignalsBannerProps {
  urgentSignals: Signal[];
  onMarkResolved: (id: string) => void;
}

export default function UrgentSignalsBanner({
  urgentSignals,
  onMarkResolved,
}: UrgentSignalsBannerProps) {
  if (urgentSignals.length === 0) return null;

  return (
    <div className="mb-4">
      {urgentSignals.map((signal) => (
        <AlertBanner
          key={signal.type}
          variant="row"
          title={SIGNAL_META[signal.type].label}
          subtitle={SIGNAL_META[signal.type].recommendedAction}
          actionLabel="Fix this →"
          onAction={() => onMarkResolved(signal.type)}
        />
      ))}
    </div>
  );
}
