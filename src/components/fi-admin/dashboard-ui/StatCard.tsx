type StatCardProps = {
  label: string;
  value: number | string;
  className?: string;
};

export function StatCard({ label, value, className = "" }: StatCardProps) {
  return (
    <div
      className={
        `rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-3 py-2.5 shadow-inner shadow-black/20 backdrop-blur-sm ` +
        className
      }
    >
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#F8FAFC]">{value}</div>
    </div>
  );
}
