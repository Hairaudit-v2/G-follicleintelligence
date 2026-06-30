"use client";

import Link from "next/link";
import { useMemo } from "react";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import {
  buildPatientLeadHistoryTimeline,
  type PatientPersonCrmActivityItem,
  type PatientPersonLeadHistoryItem,
} from "@/src/lib/patients/patientLeadHistoryShared";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

export function PatientPersonLeadHistoryCard({
  tenantId,
  currentPatientId,
  items,
  activity,
  compact,
}: {
  tenantId: string;
  currentPatientId: string;
  items: PatientPersonLeadHistoryItem[];
  activity?: PatientPersonCrmActivityItem[];
  compact?: boolean;
}) {
  const linked = items.filter((i) => i.linkedToThisPatient);
  const personOnly = items.filter((i) => !i.linkedToThisPatient);
  const timeline = useMemo(
    () => buildPatientLeadHistoryTimeline(items, activity ?? []),
    [items, activity]
  );
  const timelineRows = compact ? timeline.slice(0, 8) : timeline.slice(0, 40);

  return (
    <section className={crmLeadCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Enquiry & lead history</h2>
          <p className="mt-1 text-xs text-slate-400">
            Person-level CRM leads ({items.length}) and merged activity — linked to this patient ({linked.length}),
            prior enquiries ({personOnly.length}).
          </p>
        </div>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-xs text-blue-300 hover:underline">
          CRM →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No CRM leads for this person yet.</p>
      ) : (
        <ul className={`mt-3 divide-y divide-white/[0.06] ${compact ? "max-h-48 overflow-y-auto" : ""}`}>
          {(compact ? items.slice(0, 6) : items).map(({ lead, stageLabel, ownerLabel, linkedToThisPatient }) => {
            const title = leadTitleFromRow(lead.summary, lead.id);
            const href = `/fi-admin/${tenantId}/crm/leads/${lead.id}`;
            return (
              <li key={lead.id} className="py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={href} className="text-sm font-medium text-blue-300 hover:underline">
                      {title}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {lead.status}
                      {stageLabel ? ` · ${stageLabel}` : ""}
                      {ownerLabel ? ` · ${ownerLabel}` : ""}
                    </p>
                  </div>
                  <LeadLinkBadge
                    linkedToThisPatient={linkedToThisPatient}
                    hasOtherPatient={Boolean(lead.patient_id && lead.patient_id !== currentPatientId)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {activity && activity.length > 0 ? (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Merged CRM activity</h3>
          <ul className={`mt-2 divide-y divide-white/[0.06] ${compact ? "max-h-48 overflow-y-auto" : ""}`}>
            {timelineRows
              .filter((r) => r.kind === "crm_activity")
              .map((row) => {
                if (row.kind !== "crm_activity") return null;
                const a = row.item;
                return (
                  <li key={row.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-100">{a.title?.trim() || a.activity_kind}</span>
                      <time className="text-xs text-gray-500" dateTime={a.occurred_at}>
                        {a.occurred_at.slice(0, 16).replace("T", " ")}
                      </time>
                    </div>
                    <p className="text-xs text-slate-400">
                      {a.activity_kind}
                      {a.lead_id ? (
                        <>
                          {" · "}
                          <Link
                            href={`/fi-admin/${tenantId}/crm/leads/${a.lead_id}`}
                            className="text-blue-300 hover:underline"
                          >
                            {a.leadTitle?.trim() || `Lead ${a.lead_id.slice(0, 8)}…`}
                          </Link>
                        </>
                      ) : (
                        <>
                          {" · "}
                          <Link
                            href={`/fi-admin/${tenantId}/patients/${currentPatientId}`}
                            className="text-blue-300 hover:underline"
                          >
                            Patient record
                          </Link>
                        </>
                      )}
                      {!a.linkedToThisPatient ? (
                        <span className="ml-1 rounded bg-amber-400/10 px-1 text-[10px] font-semibold uppercase text-amber-200">
                          Other enquiry
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
          </ul>
          {!compact && timeline.filter((r) => r.kind === "crm_activity").length > timelineRows.length ? (
            <p className="mt-2 text-xs text-gray-500">Showing latest activity; see Timeline tab for full patient stream.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function LeadLinkBadge({
  linkedToThisPatient,
  hasOtherPatient,
}: {
  linkedToThisPatient: boolean;
  hasOtherPatient: boolean;
}) {
  const label = linkedToThisPatient ? "This patient" : hasOtherPatient ? "Other patient" : "Unconverted";
  const cls = linkedToThisPatient
    ? "bg-emerald-500/15 text-emerald-300"
    : hasOtherPatient
      ? "bg-amber-400/15 text-amber-200"
      : "bg-white/[0.06] text-slate-300";

  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
