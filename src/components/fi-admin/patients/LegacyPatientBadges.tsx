import type {
  LegacyPatientBadge,
  LegacyPatientBadgeKind,
} from "@/src/lib/patients/legacyPatientVisibilityCore";
import { cn } from "@/lib/utils";

const BADGE_STYLES: Record<LegacyPatientBadgeKind, string> = {
  timely: "border-sky-500/30 bg-sky-950/40 text-sky-200",
  legacy: "border-violet-500/30 bg-violet-950/40 text-violet-200",
  follow_up_active: "border-indigo-500/30 bg-indigo-950/40 text-indigo-200",
  photos_captured: "border-teal-500/30 bg-teal-950/40 text-teal-200",
  ai_review_pending: "border-orange-500/30 bg-orange-950/40 text-orange-200",
  clinician_approved: "border-emerald-500/30 bg-emerald-950/40 text-emerald-200",
  record_incomplete: "border-amber-500/30 bg-amber-950/40 text-amber-200",
  merge_review: "border-rose-500/30 bg-rose-950/40 text-rose-200",
};

export function LegacyPatientBadges({
  badges,
  className,
  maxVisible = 4,
}: {
  badges: readonly LegacyPatientBadge[];
  className?: string;
  maxVisible?: number;
}) {
  if (!badges.length) return null;
  const visible = badges.slice(0, maxVisible);
  const overflow = badges.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((badge) => (
        <span
          key={badge.kind}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide",
            BADGE_STYLES[badge.kind]
          )}
        >
          {badge.label}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-[0.62rem] font-medium text-slate-500">+{overflow}</span>
      ) : null}
    </div>
  );
}
