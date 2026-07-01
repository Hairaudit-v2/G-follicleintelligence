"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import { resolveIdentitySourceBadge } from "@/src/lib/workforce-os/staffLifecycleCore";

export type WorkforceDirectoryFilter =
  | "all"
  | "active"
  | "on_leave"
  | "terminated"
  | "archived"
  | "local"
  | "iiohr"
  | "academy"
  | "unlinked";

const FILTERS: { id: WorkforceDirectoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "on_leave", label: "On Leave" },
  { id: "terminated", label: "Terminated" },
  { id: "archived", label: "Archived" },
  { id: "local", label: "Local Records" },
  { id: "iiohr", label: "IIOHR Managed" },
  { id: "academy", label: "Academy Linked" },
  { id: "unlinked", label: "Unlinked Staff" },
];

function matchesFilter(row: StaffMemberLifecycleRow, filter: WorkforceDirectoryFilter): boolean {
  if (filter === "archived") return Boolean(row.archived_at);
  if (row.archived_at) return false;
  if (filter === "all") return true;
  if (filter === "active") return row.employment_status === "active";
  if (filter === "on_leave") return row.employment_status === "on_leave";
  if (filter === "terminated")
    return ["terminated", "resigned", "contract_ended"].includes(row.employment_status);
  if (filter === "local") return row.identity_source === "local";
  if (filter === "iiohr") return row.identity_source === "iiohr_evolved_hr";
  if (filter === "academy") return row.identity_source === "academy_sync";
  if (filter === "unlinked") return !row.iiohr_staff_record_id;
  return true;
}

export function WorkforceOsDirectoryClient({
  tenantId,
  rows,
  canManage,
}: {
  tenantId: string;
  rows: StaffMemberLifecycleRow[];
  canManage: boolean;
}) {
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [filter, setFilter] = useState<WorkforceDirectoryFilter>("all");
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (!showArchived && row.archived_at && filter !== "archived") return false;
      return matchesFilter(row, filter);
    });
  }, [rows, filter, showArchived]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            WorkforceOS
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Workforce members</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Employment lifecycle, identity source, and HR link governance.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? "rounded-full bg-[#22C1FF]/20 px-3 py-1 text-xs font-semibold text-[#22C1FF]"
                : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
            }
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[#94A3B8]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived staff
        </label>
      </div>

      <DashboardCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Identity source</th>
              <th className="px-4 py-3">Employment status</th>
              <th className="px-4 py-3">HR link</th>
              <th className="px-4 py-3">Archive</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                  No staff match the current filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const badge = resolveIdentitySourceBadge(row.identity_source);
                const staffHref = row.fi_staff_id
                  ? `${base}/staff/${row.fi_staff_id}`
                  : `${base}/staff/${row.id}`;
                return (
                  <tr key={row.id} className="border-b border-white/[0.06]">
                    <td className="px-4 py-3">
                      <Link href={staffHref} className="font-medium text-[#F8FAFC] hover:underline">
                        {row.full_name}
                      </Link>
                      <p className="text-xs text-[#64748B]">{row.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">{badge.label}</td>
                    <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                      {row.employment_status.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {row.iiohr_staff_record_id ? "Linked" : "No HR Link"}
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {row.archived_at ? "Archived" : "Active"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DashboardCard>
    </div>
  );
}
