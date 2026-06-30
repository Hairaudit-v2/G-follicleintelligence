import type { ReactNode } from "react";

export type ProgressChecklistItemProps = {
  done: boolean;
  label: string;
  hint?: string;
};

export function ProgressChecklistItem({ done, label, hint }: ProgressChecklistItemProps) {
  return (
    <li className="flex gap-3 text-sm">
      <span
        className={
          done
            ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-[#10B981]"
            : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[0.6rem] leading-none text-[#64748B]"
        }
        aria-hidden
      >
        {done ? "✓" : "○"}
      </span>
      <div className="min-w-0">
        <span className={done ? "font-medium text-[#F8FAFC]" : "text-[#94A3B8]"}>{label}</span>
        {hint ? <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">{hint}</p> : null}
      </div>
    </li>
  );
}

type ProgressChecklistProps = {
  children: ReactNode;
  className?: string;
  /** Optional 0–100 progress bar above the list */
  percentComplete?: number;
  progressLabel?: string;
};

export function ProgressChecklist({
  children,
  className = "",
  percentComplete,
  progressLabel,
}: ProgressChecklistProps) {
  const pct =
    percentComplete != null ? Math.min(100, Math.max(0, Math.round(percentComplete))) : null;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {pct != null ? (
        <div>
          <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[#081020] ring-1 ring-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22C1FF] via-[#0EA5E9] to-[#7C3AED]/90 shadow-[0_0_14px_rgba(34,193,255,0.28)] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progressLabel ? (
            <p className="mt-1.5 text-xs text-[#94A3B8]">{progressLabel}</p>
          ) : (
            <p className="mt-1.5 text-xs text-[#94A3B8]">{pct}% complete</p>
          )}
        </div>
      ) : null}
      <ul className="max-w-xl space-y-3 border-t border-white/[0.08] pt-4">{children}</ul>
    </div>
  );
}
