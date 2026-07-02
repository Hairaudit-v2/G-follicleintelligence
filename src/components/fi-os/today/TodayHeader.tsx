export function TodayHeader(props: { tenantName: string; dateLine: string; workspaceBadge?: string | null }) {
  const { tenantName, dateLine, workspaceBadge } = props;

  return (
    <header className="space-y-1.5 border-b border-white/[0.07] pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Today</p>
      <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{tenantName}</h1>
      <p className="text-sm text-slate-500">{dateLine}</p>
      {workspaceBadge ? (
        <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span className="text-cyan-400/90">{workspaceBadge}</span>
        </p>
      ) : null}
    </header>
  );
}
