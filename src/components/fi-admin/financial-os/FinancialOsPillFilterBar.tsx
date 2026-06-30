"use client";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";

export type FinancialOsPillFilterOption<T extends string = string> = {
  value: T;
  label: string;
};

export function FinancialOsPillFilterBar<T extends string>(props: {
  label?: string;
  value: T;
  options: readonly FinancialOsPillFilterOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const { label, value, options, onChange, ariaLabel, className } = props;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className={financialOsClasses.metricLabel}>{label}</p> : null}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="tablist"
        aria-label={ariaLabel ?? label ?? "Filter"}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex shrink-0 items-center px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-cyan-400/45 bg-cyan-500/10 text-cyan-50"
                  : "text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
