import Link from "next/link";

import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export type PatientTwinHeaderProps = {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
};

function formatGenerated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function mediaAssetTotal(twin: PatientTwinV1): number {
  let n = 0;
  for (const b of Object.values(twin.media.by_asset_type)) {
    n += b.count;
  }
  return n;
}

function displayName(twin: PatientTwinV1): string {
  return twin.person.display_name?.trim() || "Patient";
}

function completenessKpiTone(
  band: PatientTwinV1["completeness"]["band"]
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (band === "poor") return "danger";
  if (band === "partial") return "warning";
  if (band === "good") return "info";
  return "success";
}

function bandLabel(band: PatientTwinV1["completeness"]["band"]): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function PatientTwinHeader({ tenantId, patientId, twin }: PatientTwinHeaderProps) {
  const warnings = twin.warnings.length;
  const cases = twin.cases.length;
  const audits = twin.audits.audits_total;
  const media = mediaAssetTotal(twin);
  const c = twin.completeness;
  const profileHref = `/fi-admin/${tenantId}/patients/${patientId}`;

  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-[#102a45]/95 via-[#0c1629]/95 to-[#050a14]/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] sm:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-600/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
            Patient Twin · Read-only
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {displayName(twin)}
          </h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#94A3B8]">
            {twin.person.email ? (
              <span>
                <span className="text-[#64748B]">Email </span>
                {twin.person.email}
              </span>
            ) : (
              <span className="text-[#64748B]">No email on twin</span>
            )}
            {twin.person.phone ? (
              <span>
                <span className="text-[#64748B]">Phone </span>
                {twin.person.phone}
              </span>
            ) : null}
            {twin.person.date_of_birth ? (
              <span>
                <span className="text-[#64748B]">DOB </span>
                {twin.person.date_of_birth}
              </span>
            ) : null}
          </div>
          {twin.person.address?.trim() ? (
            <p className="text-sm text-[#94A3B8]">
              <span className="text-[#64748B]">Address </span>
              {twin.person.address}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B]">
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[#CBD5E1]">
              {twin.version}
            </span>
            <span aria-hidden>·</span>
            <span>Generated {formatGenerated(twin.provenance.generated_at)}</span>
            <span aria-hidden>·</span>
            <Link
              href={profileHref}
              className="text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Open clinical profile
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="#patient-twin-completeness"
              className="text-cyan-300/90 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Completeness detail
            </Link>
          </div>
        </div>

        <div className="grid w-full max-w-2xl shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:max-w-none xl:grid-cols-5">
          <FiKpiTile
            label="Completeness"
            value={String(c.score)}
            description={`${bandLabel(c.band)} · longitudinal record`}
            tone={completenessKpiTone(c.band)}
          />
          <FiKpiTile
            label="Warnings"
            value={String(warnings)}
            description={warnings === 0 ? "No coverage flags" : "Review twin warnings"}
            tone={warnings > 0 ? "warning" : "neutral"}
          />
          <FiKpiTile
            label="Cases"
            value={String(cases)}
            description="Linked fi_cases"
            tone="info"
          />
          <FiKpiTile
            label="Audits"
            value={String(audits)}
            description="fi_audits rows"
            tone="neutral"
          />
          <FiKpiTile
            label="Media"
            value={String(media)}
            description="Unified assets"
            tone="neutral"
          />
        </div>
      </div>
    </header>
  );
}
