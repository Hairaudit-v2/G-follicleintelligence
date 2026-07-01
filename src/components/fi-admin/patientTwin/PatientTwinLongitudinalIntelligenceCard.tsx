import Link from "next/link";

import type { PatientTwinImagingGalleryItem } from "@/src/lib/patientTwin/patientTwinTypes";

function StatusBadge({ label, tone }: { label: string; tone: "amber" | "rose" | "emerald" | "slate" }) {
  const tones = {
    amber: "bg-amber-500/10 text-amber-200",
    rose: "bg-rose-500/10 text-rose-200",
    emerald: "bg-emerald-500/10 text-emerald-200",
    slate: "bg-white/5 text-slate-400",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>{label}</span>
  );
}

export function PatientTwinLongitudinalIntelligenceSummary({
  img,
}: {
  img: PatientTwinImagingGalleryItem;
}) {
  const intel = img.intelligence;
  if (!intel) return null;

  return (
    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/80">
        ImagingOS intelligence (staff)
      </p>
      <div className="flex flex-wrap gap-1">
        {img.journey_phase ? <StatusBadge label={img.journey_phase} tone="slate" /> : null}
        {intel.retake_required ? <StatusBadge label="Retake required" tone="rose" /> : null}
        {intel.review_required && !intel.retake_required ? (
          <StatusBadge label="Review required" tone="amber" />
        ) : null}
        {intel.staff_review_status === "reviewed" ? (
          <StatusBadge label="Staff reviewed" tone="emerald" />
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
        <div>
          <span className="text-slate-500">View</span>
          <p className="text-slate-200">{intel.view_type ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-500">Quality</span>
          <p className="capitalize text-slate-200">{intel.quality_status ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-500">Capture</span>
          <p className="text-slate-200">{intel.capture_source ?? "—"}</p>
        </div>
        <div>
          <span className="text-slate-500">Session</span>
          <p className="text-slate-200">
            {img.session_date ? new Date(img.session_date).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>
      {intel.observations.length > 0 ? (
        <ul className="space-y-0.5 text-[10px] text-slate-400">
          {intel.observations.slice(0, 3).map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-[10px] text-slate-500">{intel.limitations[0]}</p>
      <div className="flex flex-wrap gap-2">
        {img.deep_links.links.map((link) => (
          <Link key={link.href} href={link.href} className="text-[10px] text-sky-400 hover:text-sky-300">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}