import type { ViePatientImagingCompleteness } from "@/src/lib/vie/vieProtocolTypes";
import { formatVieCompletenessHeadline } from "@/src/lib/vie/vieCompleteness";

function qualityLabel(completeness: ViePatientImagingCompleteness): string | null {
  const q = completeness.latest_capture_quality;
  if (!q) return null;
  const usability = q.clinically_usable ? "clinically usable" : "needs review";
  const acceptance = q.acceptance_status === "accepted" ? "accepted" : q.acceptance_status;
  return `Latest: ${q.quality_score}/100 · ${acceptance} · ${usability}`;
}

export function PatientImagingCompletenessSummary({
  completeness,
  variant = "light",
}: {
  completeness: ViePatientImagingCompleteness;
  variant?: "light" | "dark";
}) {
  const headline = formatVieCompletenessHeadline(completeness);
  const pct = completeness.headline.percent;
  const qualityLine = qualityLabel(completeness);

  const trackClass = variant === "dark" ? "bg-white/10" : "bg-white/[0.08]";
  const fillClass = pct >= 100 ? "bg-emerald-500" : "bg-cyan-500";
  const textClass = variant === "dark" ? "text-slate-300" : "text-slate-300";
  const labelClass = variant === "dark" ? "text-slate-500" : "text-gray-500";

  return (
    <div className={variant === "dark" ? "rounded-md bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]" : ""}>
      <p className={`text-[0.55rem] font-semibold uppercase tracking-[0.15em] ${labelClass}`}>Imaging completeness</p>
      <p className={`mt-0.5 text-sm font-medium ${textClass}`}>{headline}</p>
      {qualityLine ? <p className={`mt-1 text-xs ${labelClass}`}>{qualityLine}</p> : null}
      <div
        className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 grid gap-1 text-[0.65rem]">
        <p className={textClass}>Consultation: {completeness.consultation.display}</p>
        <p className={textClass}>Full head series: {completeness.full_head_series.display}</p>
        <p className={textClass}>Donor docs: {completeness.donor_documentation.display}</p>
        <p className={textClass}>Surgical docs: {completeness.surgical_documentation.display}</p>
      </div>
    </div>
  );
}
