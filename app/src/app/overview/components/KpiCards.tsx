interface KpiCardsProps {
  total: number;
  active: number;
  needsAttention: number;
}

export default function KpiCards({ total, active, needsAttention }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-12 grid-rows-2 gap-6">
      {/* Total workflows — large card, spans both rows */}
      <div className="col-span-8 row-span-2 flex flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-8 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Total Workflows
        </p>
        <p className="mt-3 text-5xl font-bold text-indigo-600">{total}</p>
      </div>

      {/* Active */}
      <div className="col-span-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Active
        </p>
        <p className="mt-1.5 text-4xl font-bold text-emerald-600">{active}</p>
      </div>

      {/* Needs Attention */}
      <div className="col-span-4 rounded-2xl border border-amber-200 bg-amber-50/40 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Needs Attention
        </p>
        <p className="mt-1.5 text-4xl font-bold text-amber-500">{needsAttention}</p>
      </div>
    </div>
  );
}
