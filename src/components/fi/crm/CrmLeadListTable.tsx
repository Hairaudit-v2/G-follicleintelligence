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
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Lead</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Person / patient</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Stage</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Priority</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Owner</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Updated</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((row) => {
            const href = `/fi-admin/${tenantId}/crm/leads/${row.lead.id}`;
            const personLabel = row.person ? personMetadataDisplayLabel(row.person.metadata) : "—";
            const patientBit = row.patient ? ` · Patient ${row.patient.id.slice(0, 8)}…` : "";
            const title = leadTitleFromRow(row.lead.summary, row.lead.id);
            return (
              <tr key={row.lead.id} className="hover:bg-gray-50">
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
                <td className="px-3 py-2 text-gray-700">
                  {personLabel}
                  {patientBit}
                </td>
                <td className="px-3 py-2 text-gray-800">{row.stage?.label ?? "—"}</td>
                <td className="px-3 py-2 text-gray-700">{row.lead.status}</td>
                <td className="px-3 py-2 text-gray-700">{row.lead.priority ?? "—"}</td>
                <td className="px-3 py-2 text-gray-700">{row.owner?.email ?? row.lead.primary_owner_user_id ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtTs(row.lead.updated_at)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtTs(row.lead.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
