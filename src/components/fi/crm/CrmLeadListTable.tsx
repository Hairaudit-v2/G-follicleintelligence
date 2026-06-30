"use client";

import Link from "next/link";
import type { CrmShellLeadListItem } from "@/src/lib/crm/types";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { useCrmLeadSlideOverOptional } from "./crmLeadSlideOverContext";

function fmtTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function CrmLeadListTable({
  tenantId,
  items,
}: {
  tenantId: string;
  items: CrmShellLeadListItem[];
}) {
  const slide = useCrmLeadSlideOverOptional();
  return (
    <div className="overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
      <table className="min-w-full divide-y divide-white/[0.08] text-sm">
        <thead className="bg-white/[0.03]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Lead</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Person / patient</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Stage</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Updated</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {items.map((row) => {
            const href = `/fi-admin/${tenantId}/crm/leads/${row.lead.id}`;
            const personLabel = row.person ? personMetadataDisplayLabel(row.person.metadata) : "—";
            const patientBit = row.patient ? ` · Patient ${row.patient.id.slice(0, 8)}…` : "";
            const title = leadTitleFromRow(row.lead.summary, row.lead.id);
            return (
              <tr key={row.lead.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2">
                  {slide ? (
                    <button
                      type="button"
                      className="text-left font-medium text-blue-700 hover:underline"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          window.open(href, "_blank", "noopener,noreferrer");
                          return;
                        }
                        slide.openLead(row.lead.id);
                      }}
                    >
                      {title}
                    </button>
                  ) : (
                    <Link href={href} className="font-medium text-blue-700 hover:underline">
                      {title}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {personLabel}
                  {patientBit}
                </td>
                <td className="px-3 py-2 text-slate-200">{row.stage?.label ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{row.lead.status}</td>
                <td className="px-3 py-2 text-slate-300">{row.lead.priority ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{row.owner?.email ?? row.lead.primary_owner_user_id ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-400">{fmtTs(row.lead.updated_at)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-400">{fmtTs(row.lead.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
