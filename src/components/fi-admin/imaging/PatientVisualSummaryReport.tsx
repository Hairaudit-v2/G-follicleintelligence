import Image from "next/image";

import {
  formatZoneDisplayValue,
  reportTypeLabel,
} from "@/src/lib/imaging-os/patientVisualSummaryReportCore";
import {
  PATIENT_VISUAL_SUMMARY_NOT_RECORDED,
  type PatientVisualSummaryReport,
} from "@/src/lib/imaging-os/patientVisualSummaryReportTypes";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
  );
}

function ValueRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 text-right">{value}</span>
    </div>
  );
}

export function PatientVisualSummaryReportView({ report }: { report: PatientVisualSummaryReport }) {
  const g = report.graftTypeSummary;

  return (
    <div className="space-y-6 rounded-xl border border-white/[0.08] bg-[#0B1220] p-5 sm:p-6">
      <header className="space-y-2 border-b border-white/[0.06] pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/80">
          Patient visual summary
        </p>
        <h2 className="text-lg font-semibold text-white">{report.header.reportTypeLabel}</h2>
        <div className="grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Patient: </span>
            {report.header.patientDisplay}
          </p>
          {report.header.clinicName ? (
            <p>
              <span className="text-slate-500">Clinic: </span>
              {report.header.clinicName}
            </p>
          ) : null}
          {report.header.procedureOrAuditDate ? (
            <p>
              <span className="text-slate-500">Date: </span>
              {new Date(report.header.procedureOrAuditDate).toLocaleDateString()}
            </p>
          ) : null}
          <p>
            <span className="text-slate-500">Generated: </span>
            {new Date(report.header.generatedAt).toLocaleDateString()}
          </p>
          <p>
            <span className="text-slate-500">Approval: </span>
            <span className="capitalize">{report.approval.status}</span>
          </p>
        </div>
        <p className="text-xs text-slate-500">{report.header.disclaimer}</p>
      </header>

      <section className="space-y-3">
        <SectionTitle>Post-op photo panel</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.photoPanel.map((photo) => (
            <div
              key={photo.slot}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <p className="text-xs font-medium text-slate-300">{photo.label}</p>
              {photo.preview_signed_url ? (
                <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-md bg-black/40">
                  <Image
                    src={photo.preview_signed_url}
                    alt={photo.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">{photo.status_message}</p>
              )}
              {photo.photo_date ? (
                <p className="mt-1 text-[10px] text-slate-500">
                  {new Date(photo.photo_date).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Graft distribution map</SectionTitle>
        <div className="grid gap-2">
          {report.graftDistributionZones.map((zone) => (
            <div
              key={zone.zoneId}
              className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
            >
              <p className="font-medium text-slate-200">{zone.label}</p>
              <p className="text-xs text-slate-500">{zone.description}</p>
              <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <p>Grafts: {formatZoneDisplayValue(zone.graftCount)}</p>
                <p>
                  Density: {zone.densityRange?.trim() || PATIENT_VISUAL_SUMMARY_NOT_RECORDED}
                </p>
                {zone.graftTypeMix && Object.keys(zone.graftTypeMix).length > 0 ? (
                  <p className="sm:col-span-2 text-slate-400">
                    Mix:{" "}
                    {[
                      zone.graftTypeMix.singles != null ? `S ${zone.graftTypeMix.singles}` : null,
                      zone.graftTypeMix.doubles != null ? `D ${zone.graftTypeMix.doubles}` : null,
                      zone.graftTypeMix.triples != null ? `T ${zone.graftTypeMix.triples}` : null,
                      zone.graftTypeMix.multiHair != null ? `4+ ${zone.graftTypeMix.multiHair}` : null,
                      zone.graftTypeMix.fiveHair != null ? `5 ${zone.graftTypeMix.fiveHair}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || PATIENT_VISUAL_SUMMARY_NOT_RECORDED}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {report.hairlinePrinciples.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Hairline / design principles</SectionTitle>
          <ul className="list-inside list-disc text-sm text-slate-300">
            {report.hairlinePrinciples.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-2">
          <SectionTitle>Hairline / design principles</SectionTitle>
          <p className="text-sm text-slate-500">{PATIENT_VISUAL_SUMMARY_NOT_RECORDED}</p>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>Graft type summary</SectionTitle>
        <div className="rounded-lg border border-white/[0.06] px-3 py-2 space-y-1">
          <ValueRow label="Singles" value={g.singles} />
          <ValueRow label="Doubles" value={g.doubles} />
          <ValueRow label="Triples" value={g.triples} />
          <ValueRow label="4+ hair grafts" value={g.fourPlusHair} />
          <ValueRow label="5-hair grafts" value={g.fiveHair} />
        </div>
      </section>

      {report.densityZones.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Density gradient</SectionTitle>
          <ul className="space-y-1 text-sm text-slate-300">
            {report.densityZones.map((dz) => (
              <li key={dz.label}>
                {dz.label}: {dz.qualitativeLabel}
                {dz.graftsPerCm2 != null ? ` (${dz.graftsPerCm2} grafts/cm²)` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <SectionTitle>Expected healing / growth timeline</SectionTitle>
        <ul className="space-y-1 text-sm text-slate-300">
          {report.healingTimeline.map((m) => (
            <li key={m.month}>
              {m.month} month: {m.label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{report.timelineVariationNote}</p>
      </section>

      {report.followUpPlan ? (
        <section className="space-y-2">
          <SectionTitle>Follow-up plan</SectionTitle>
          <p className="text-sm text-slate-300">{report.followUpPlan}</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <SectionTitle>What we will monitor</SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {report.monitoringItems.map((item) => (
            <li
              key={item}
              className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-slate-300"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      {report.auditSummary ? (
        <section className="space-y-2">
          <SectionTitle>Audit mode summary</SectionTitle>
          <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-sm text-slate-300 space-y-1">
            <p>
              Views received:{" "}
              {report.auditSummary.uploadedViews.length > 0
                ? report.auditSummary.uploadedViews.join(", ")
                : PATIENT_VISUAL_SUMMARY_NOT_RECORDED}
            </p>
            <p>Image quality: {report.auditSummary.imageQualityStatus}</p>
            <p>Clinical review: {report.auditSummary.clinicalReviewStatus}</p>
            {report.auditSummary.missingOrRetakeViews.length > 0 ? (
              <p>Retake requested: {report.auditSummary.missingOrRetakeViews.join(", ")}</p>
            ) : null}
            <p>
              Longitudinal comparison:{" "}
              {report.auditSummary.longitudinalComparisonAvailable
                ? "Available"
                : "Not available"}
            </p>
            <p className="text-slate-400">{report.auditSummary.patientSafeSummary}</p>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-white/[0.06] pt-3 text-[10px] text-slate-500">
        {reportTypeLabel(report.reportType)} · {report.version}
        {!report.patientAccessAllowed ? " · Patient access requires staff approval" : null}
      </footer>
    </div>
  );
}