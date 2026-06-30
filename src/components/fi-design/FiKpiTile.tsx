import { cn } from "@/lib/utils";

const toneAccent: Record<NonNullable<FiKpiTileProps["tone"]>, string> = {
  neutral: "border-white/[0.08]",
  info: "border-cyan-500/20 ring-1 ring-sky-100/80",
  success: "border-emerald-500/20",
  warning: "border-amber-400/20",
  danger: "border-rose-500/20",
};

export type FiKpiTileProps = {
  label: string;
  value: string;
  description?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
};

export function FiKpiTile({
  label,
  value,
  description,
  tone = "neutral",
  className,
}: FiKpiTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-[#0F1629]/80 backdrop-blur-md p-3.5 shadow-lg shadow-black/40",
        toneAccent[tone],
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-200">
        {value}
      </p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}
