import { cn } from "@/lib/utils";

const toneAccent: Record<NonNullable<FiKpiTileProps["tone"]>, string> = {
  neutral: "border-slate-200",
  info: "border-sky-200 ring-1 ring-sky-100/80",
  success: "border-emerald-200",
  warning: "border-amber-200",
  danger: "border-red-200",
};

export type FiKpiTileProps = {
  label: string;
  value: string;
  description?: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  className?: string;
};

export function FiKpiTile({ label, value, description, tone = "neutral", className }: FiKpiTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3.5 shadow-sm",
        toneAccent[tone],
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-800">{value}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}
