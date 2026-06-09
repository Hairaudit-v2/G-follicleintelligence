"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  saveAllStaffRoleReviewAction,
  saveStaffRoleReviewRowAction,
} from "@/src/lib/actions/fi-staff-role-review-actions";
import { StaffHrNotificationBadge } from "@/src/components/fi/staff/StaffHrNotificationBadge";
import { StaffPayrollMetadataPanel } from "@/src/components/fi/staff/StaffPayrollMetadataPanel";
import { StaffWeeklyHoursEditor } from "@/src/components/fi/staff/StaffWeeklyHoursEditor";
import type { StaffDirectoryClinicOption } from "@/src/lib/staff/staffDirectoryLoader.server";
import {
  applyBulkDefaultWeeklyHours,
  applyBulkNonClinicalAdminRole,
  applyBulkPrimaryClinic,
  computeStaffRoleReviewProgress,
  NEEDS_REVIEW_STAFF_ROLE,
  type StaffRoleReviewEditableRow,
  validateStaffRoleReviewSave,
} from "@/src/lib/staff/staffRoleReviewApply";
import { CLINICAL_STAFF_ROLE_OPTIONS } from "@/src/lib/staff/staffRolePolicy";
import { defaultPerthClinicWeeklyHours } from "@/src/lib/staff/staffWeeklyHours";

function rowPayload(row: StaffRoleReviewEditableRow) {
  return {
    staffId: row.staffId,
    staff_role: row.staff_role,
    position_title: row.position_title,
    primary_clinic_id: row.primary_clinic_id,
    weekly: row.weekly,
    is_active: row.is_active,
  };
}

export function StaffRoleReviewClient({
  tenantId,
  initialRows,
  clinics,
}: {
  tenantId: string;
  initialRows: StaffRoleReviewEditableRow[];
  clinics: StaffDirectoryClinicOption[];
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialRows.map((r) => r.staffId)));
  const [bulkClinicId, setBulkClinicId] = useState("");
  const [expandedHours, setExpandedHours] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setRows(initialRows);
    setSelected(new Set(initialRows.map((r) => r.staffId)));
  }, [initialRows]);

  const progress = useMemo(() => computeStaffRoleReviewProgress(rows), [rows]);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.staffId)));
  };

  const toggleSelect = (staffId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  };

  const patchRow = useCallback((staffId: string, patch: Partial<StaffRoleReviewEditableRow>) => {
    setRows((prev) => prev.map((r) => (r.staffId === staffId ? { ...r, ...patch } : r)));
  }, []);

  const applyBulkClinic = () => {
    if (!bulkClinicId.trim()) {
      setError("Choose a clinic for bulk assignment.");
      return;
    }
    setError(null);
    setRows((prev) => applyBulkPrimaryClinic(prev, selected, bulkClinicId.trim()));
  };

  const applyBulkHours = () => {
    setError(null);
    setRows((prev) => applyBulkDefaultWeeklyHours(prev, selected, defaultPerthClinicWeeklyHours()));
  };

  const applyBulkAdmin = () => {
    setError(null);
    setRows((prev) => applyBulkNonClinicalAdminRole(prev, selected));
  };

  const saveOne = (row: StaffRoleReviewEditableRow) => {
    setError(null);
    const validation = validateStaffRoleReviewSave(row);
    if (validation) {
      setRowMessage((m) => ({ ...m, [row.staffId]: validation }));
      return;
    }
    startTransition(async () => {
      const r = await saveStaffRoleReviewRowAction(tenantId, rowPayload(row));
      if (!r.ok) {
        setRowMessage((m) => ({ ...m, [row.staffId]: r.error }));
        return;
      }
      setRowMessage((m) => {
        const next = { ...m };
        delete next[row.staffId];
        return next;
      });
      router.refresh();
    });
  };

  const saveAll = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveAllStaffRoleReviewAction(tenantId, { rows: rows.map(rowPayload) });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (initialRows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-8 px-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-emerald-950">All staff roles assigned</h1>
          <p className="mt-2 text-sm text-emerald-900/90">
            No active staff remain with role <code className="rounded bg-emerald-100 px-1 text-xs">needs_review</code>.
            Payroll-imported staff can now appear in clinical booking pickers once their assigned roles are saved.
          </p>
          <p className="mt-6">
            <Link href={`${base}/staff`} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              Back to Staff directory
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Payroll follow-up</p>
        <h1 className="text-2xl font-semibold text-gray-900">Assign staff roles</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Review payroll-imported team members and assign operational roles before they can be used on the calendar or as
          clinical providers. Payroll metadata below is read-only.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
            {progress.assigned} of {progress.total} staff roles assigned
          </span>
          {progress.isComplete ? (
            <span className="text-emerald-700">Ready to save all — every row has an operational role.</span>
          ) : (
            <span className="text-gray-500">{progress.remaining} remaining with needs_review</span>
          )}
          <Link href={`${base}/staff`} className="text-blue-600 hover:underline">
            Staff directory
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Bulk tools</h2>
        <p className="mt-1 text-xs text-gray-500">Select rows below, apply bulk changes, then save each row or save all.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Primary clinic
            <select
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={bulkClinicId}
              onChange={(e) => setBulkClinicId(e.target.value)}
            >
              <option value="">— Select clinic —</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" size="sm" disabled={!selected.size || pending} onClick={applyBulkClinic}>
            Set clinic for selected ({selected.size})
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!selected.size || pending} onClick={applyBulkHours}>
            Default Perth hours for selected
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!selected.size || pending} onClick={applyBulkAdmin}>
            Mark selected as admin (non-clinical)
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2">Staff</th>
              <th className="px-3 py-2">Payroll (read-only)</th>
              <th className="px-3 py-2">Assign role</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const rowErr = rowMessage[row.staffId];
              const hoursOpen = expandedHours.has(row.staffId);
              return (
                <tr key={row.staffId} className="align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.staffId)}
                      onChange={() => toggleSelect(row.staffId)}
                      aria-label={`Select ${row.full_name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-900">{row.full_name}</p>
                    <p className="text-xs text-gray-600">{row.email ?? "—"}</p>
                    {row.mobile ? <p className="text-xs text-gray-500">{row.mobile}</p> : null}
                    {row.payroll ? (
                      <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
                        Payroll
                      </span>
                    ) : null}
                    {row.position_title ? (
                      <p className="mt-1 text-xs text-gray-600">Title: {row.position_title}</p>
                    ) : null}
                    <div className="mt-2">
                      <StaffHrNotificationBadge summary={row.hrNotification} compact />
                    </div>
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-gray-700">
                    {row.payroll ? (
                      <dl className="space-y-1">
                        <div>
                          <dt className="text-gray-500">Employment</dt>
                          <dd>{row.payroll.employment_type ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Start</dt>
                          <dd>{row.payroll.start_date ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Hours/week</dt>
                          <dd>{row.payroll.hours_per_week ?? "—"}</dd>
                        </div>
                      </dl>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="grid max-w-md gap-2">
                      <label className="block text-xs font-medium text-gray-700">
                        Role
                        <select
                          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm capitalize"
                          value={row.staff_role}
                          onChange={(e) => patchRow(row.staffId, { staff_role: e.target.value })}
                        >
                          <option value={NEEDS_REVIEW_STAFF_ROLE}>needs review</option>
                          {CLINICAL_STAFF_ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-gray-700">
                        Position / title
                        <input
                          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.position_title ?? ""}
                          onChange={(e) => patchRow(row.staffId, { position_title: e.target.value || null })}
                        />
                      </label>
                      <label className="block text-xs font-medium text-gray-700">
                        Primary clinic
                        <select
                          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                          value={row.primary_clinic_id ?? ""}
                          onChange={(e) => patchRow(row.staffId, { primary_clinic_id: e.target.value || null })}
                        >
                          <option value="">— None —</option>
                          {clinics.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.display_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-800">
                        <input
                          type="checkbox"
                          checked={row.is_active}
                          onChange={(e) => patchRow(row.staffId, { is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="text-left text-xs font-medium text-blue-600 hover:underline"
                        onClick={() =>
                          setExpandedHours((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.staffId)) next.delete(row.staffId);
                            else next.add(row.staffId);
                            return next;
                          })
                        }
                      >
                        {hoursOpen ? "Hide weekly hours" : "Edit weekly hours"}
                      </button>
                      {hoursOpen ? (
                        <StaffWeeklyHoursEditor
                          value={row.weekly}
                          onChange={(weekly) => patchRow(row.staffId, { weekly })}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Button type="button" size="sm" disabled={pending} onClick={() => saveOne(row)}>
                      Save
                    </Button>
                    {rowErr ? <p className="mt-2 text-xs text-red-600">{rowErr}</p> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.payroll) ? (
        <details className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-800">Sample payroll metadata panel (read-only)</summary>
          <div className="mt-4 max-w-2xl">
            {rows.find((r) => r.payroll)?.payroll ? (
              <StaffPayrollMetadataPanel payroll={rows.find((r) => r.payroll)!.payroll!} variant="light" />
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || !progress.isComplete} onClick={saveAll}>
          Save all reviewed changes
        </Button>
        <p className="self-center text-xs text-gray-500">
          Save all requires every row to have a role other than needs_review.
        </p>
      </div>
    </div>
  );
}
