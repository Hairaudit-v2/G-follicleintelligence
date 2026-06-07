import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function shortWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export type PatientTwinCasesCardProps = {
  tenantId: string;
  twin: PatientTwinV1;
};

export function PatientTwinCasesCard({ tenantId, twin }: PatientTwinCasesCardProps) {
  const empty = twin.cases.length === 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-cases-heading"
      title="Cases"
      description="All cases linked to this foundation patient (global bridge when present)."
    >
      {empty ? (
        <p className="text-sm text-[#94A3B8]">No cases linked yet.</p>
      ) : (
        <ul className="space-y-3">
          {twin.cases.map((c) => {
            const href = `/fi-admin/${tenantId}/cases/${c.case_id}`;
            return (
              <li
                key={c.case_id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-cyan-500/25 hover:bg-white/[0.05]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200/95 hover:text-cyan-100"
                    >
                      Case
                      <span className="font-mono text-xs text-[#94A3B8]">{c.case_id.slice(0, 8)}…</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    </Link>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {c.case_type ? <span>{c.case_type} · </span> : null}
                      <span className="text-[#CBD5E1]">Status {c.status}</span>
                      {c.clinic_display_name ? <span> · {c.clinic_display_name}</span> : null}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[#64748B]">
                    <div>Created {shortWhen(c.created_at)}</div>
                    {c.global_case_id ? (
                      <div className="mt-0.5 font-mono text-[10px] text-[#475569]">Global {c.global_case_id.slice(0, 8)}…</div>
                    ) : null}
                  </div>
                </div>
                {c.latest_milestone ? (
                  <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs text-[#94A3B8]">
                    <span className="text-[#64748B]">Latest milestone </span>
                    {c.latest_milestone.title ?? c.latest_milestone.event_kind}
                    <span className="text-[#64748B]"> · {shortWhen(c.latest_milestone.occurred_at)}</span>
                  </p>
                ) : (
                  <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs text-[#64748B]">No timeline milestone on file.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </FiSection>
  );
}
