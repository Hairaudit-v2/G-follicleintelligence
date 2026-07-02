export function WorkforceOsSkeleton() {
  return (
    <div className="mx-auto min-w-0 max-w-[96rem] animate-pulse space-y-10 pb-14">
      <div className="h-40 rounded-2xl border border-white/[0.1] bg-[#0c1426]/90" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl border border-white/[0.1] bg-[#0c1426]/80" />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-white/[0.1] bg-[#0c1426]/70" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl border border-white/[0.08] bg-[#0c1426]/60" />
        ))}
      </div>
    </div>
  );
}