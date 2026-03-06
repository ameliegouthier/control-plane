import type { WorkflowWithEnrichment, DuplicatePair } from "@/lib/enrichment";
import WorkflowAlertItem from "./WorkflowAlertItem";

interface NeedsAttentionPanelProps {
  broken: WorkflowWithEnrichment[];
  warnings: WorkflowWithEnrichment[];
  duplicates: DuplicatePair[];
}

export default function NeedsAttentionPanel({
  broken,
  warnings,
  duplicates,
}: NeedsAttentionPanelProps) {
  const isEmpty =
    broken.length === 0 && warnings.length === 0 && duplicates.length === 0;

  if (isEmpty) {
    return (
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Needs Attention
        </h2>
        <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">All workflows look healthy.</p>
        </div>
      </section>
    );
  }

  // If no broken and no duplicates, show warnings under "Warning" title
  const showWarningsAsBroken = broken.length === 0 && duplicates.length === 0;

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Needs Attention
      </h2>

      <div className="mt-4 grid gap-10 lg:grid-cols-2">
        {/* Left column: Broken + Duplicates */}
        <div className="space-y-8">
          {/* Broken section */}
          {broken.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <h3 className="text-xs font-semibold text-foreground">
                  Broken — Action Required
                </h3>
              </div>
              <div className="space-y-3">
                {broken.map((wf) => (
                  <WorkflowAlertItem
                    key={wf.id}
                    variant="broken"
                    title={wf.name}
                    subtitle={wf.enrichment.reason}
                    actionLabel="View →"
                    href={`/workflows/${wf.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Warnings shown in left column when no broken/duplicates */}
          {showWarningsAsBroken && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                <h3 className="text-xs font-semibold text-foreground">
                  Warnings — Monitor These
                </h3>
              </div>
              <div className="space-y-3">
                {warnings.map((wf) => (
                  <WorkflowAlertItem
                    key={wf.id}
                    variant="warning"
                    title={wf.name}
                    subtitle={wf.enrichment.reason}
                    actionLabel="View →"
                    href={`/workflows/${wf.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Duplicates section */}
          {duplicates.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm leading-none text-warning">⚠</span>
                <h3 className="text-xs font-semibold text-foreground">
                  Potential Duplicates
                </h3>
              </div>
              <div className="space-y-3">
                {duplicates.map((pair) => (
                  <WorkflowAlertItem
                    key={`${pair.idA}:${pair.idB}`}
                    variant="duplicate"
                    title={pair.nameA}
                    subtitle={
                      pair.reason === "exact_name"
                        ? "Appears twice with the same name"
                        : `Similar to '${pair.nameB}'`
                    }
                    actionLabel="Review →"
                    href={`/workflows/${pair.idA}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Warnings (only show if there are broken or duplicates) */}
        {warnings.length > 0 && !showWarningsAsBroken && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" />
              <h3 className="text-xs font-semibold text-foreground">
                Warnings — Monitor These
              </h3>
            </div>
            <div className="space-y-3">
              {warnings.map((wf) => (
                <WorkflowAlertItem
                  key={wf.id}
                  variant="warning"
                  title={wf.name}
                  subtitle={wf.enrichment.reason}
                  actionLabel="View →"
                  href={`/workflows/${wf.id}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
