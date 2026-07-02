export function ReceptionBoardSkeleton() {
  return (
    <div className="mx-auto min-w-0 max-w-[100rem] animate-pulse space-y-8 pb-14">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220] p-6 sm:p-8">
        <div className="h-3 w-40 rounded bg-white/[0.06]" />
        <div className="mt-4 h-9 w-72 max-w-full rounded bg-white/[0.08]" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-white/[0.05]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-white/[0.08] bg-[#0f1729]/80" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="h-80 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60" />
          <div className="h-64 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60" />
        </div>
        <div className="space-y-6 xl:col-span-4">
          <div className="h-48 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60" />
          <div className="h-56 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60" />
        </div>
      </div>
    </div>
  );
}