export function PatientProfileSkeleton() {
  return (
    <div className="mx-auto min-w-0 max-w-[88rem] animate-pulse space-y-8 pb-14">
      <div className="h-32 rounded-2xl border border-white/[0.08] bg-[#0c1426]/80" />
      <div className="h-24 rounded-2xl border border-white/[0.08] bg-[#0c1426]/60" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60 lg:col-span-2" />
        <div className="h-96 rounded-2xl border border-white/[0.08] bg-[#0f1729]/60" />
      </div>
    </div>
  );
}