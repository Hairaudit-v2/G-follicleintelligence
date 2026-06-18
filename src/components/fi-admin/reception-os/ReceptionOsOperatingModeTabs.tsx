import { Sunrise, Activity, Moon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  RECEPTION_OS_OPERATING_MODE_LABELS,
  type ReceptionOsOperatingMode,
} from "@/src/lib/receptionOs/receptionOperatingMode";

const MODE_ICONS: Record<ReceptionOsOperatingMode, typeof Sunrise> = {
  morning_prep: Sunrise,
  live_clinic: Activity,
  end_of_day: Moon,
};

export function ReceptionOsOperatingModeTabs({
  mode,
  suggestedMode,
  onChange,
}: {
  mode: ReceptionOsOperatingMode;
  suggestedMode: ReceptionOsOperatingMode;
  onChange: (mode: ReceptionOsOperatingMode) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Clinic operating mode">
      {(Object.keys(RECEPTION_OS_OPERATING_MODE_LABELS) as ReceptionOsOperatingMode[]).map((key) => {
        const Icon = MODE_ICONS[key];
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold transition",
              active ? "border-cyan-400/40 text-cyan-100" : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {RECEPTION_OS_OPERATING_MODE_LABELS[key]}
            {suggestedMode === key && !active ? (
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-cyan-300/90">
                Suggested
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
