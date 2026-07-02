export function ProcedureDaySkeleton() {
  return (
    <div className="mx-auto min-w-0 max-w-[88rem] animate-pulse space-y-8 pb-14">
      <div className="h-48 rounded-2xl border border-white/[0.08] bg-[#0c1220]/90" />
      <div className="h-64 rounded-2xl border border-white/[0.08] bg-[#0c1220]/70" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 rounded-2xl border border-white/[0.08] bg-[#0c1220]/60" />
        <div className="h-80 rounded-2xl border border-white/[0.08] bg-[#0c1220]/60" />
      </div>
    </div>
  );
}