"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createStaffAction, updateStaffAction } from "@/lib/actions/fi-staff-actions";
import { StaffFeatureAccessPanel } from "@/src/components/fi/staff/StaffFeatureAccessPanel";
import { StaffHrNotificationBadge, StaffHrNotificationDetailCard } from "@/src/components/fi/staff/StaffHrNotificationBadge";
import { StaffPayrollMetadataPanel } from "@/src/components/fi/staff/StaffPayrollMetadataPanel";
import { StaffPinSettingsPanel } from "@/src/components/fi/staff/StaffPinSettingsPanel";
import { StaffWeeklyHoursEditor } from "@/src/components/fi/staff/StaffWeeklyHoursEditor";
import { detectStaffHrSyncIssues } from "@/src/lib/hr/hrStaffSyncHealthDashboard";
import type { StaffDirectoryPageResult } from "@/src/lib/staff/staffDirectoryLoader.server";
import {
  buildStaffDirectorySearchParams,
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
  type StaffDirectoryFilterState,
} from "@/src/lib/staff/staffDirectoryFilters";
import { mergeStaffWorkingHoursDocument, parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import { CLINICAL_STAFF_ROLE_OPTIONS, NEEDS_REVIEW_STAFF_ROLE } from "@/src/lib/staff/staffRolePolicy";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import {
  formatStaffWeeklyHoursSummary,
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
  type StaffWeeklyHoursMap,
} from "@/src/lib/staff/staffWeeklyHours";

type Mode = "idle" | "create" | "edit";

function emptyForm(): Record<string, string> {
  return {
    full_name: "",
    staff_role: "consultant",
    position_title: "",
    primary_clinic_id: "",
    email: "",
    mobile: "",
    default_timezone: "",
    calendar_color: "#0ea5e9",
    fi_user_id: "",
    is_active: "on",
  };
}

function rowToForm(row: FiStaffRow): Record<string, string> {
  const profile = parseStaffProfileExtras(row.working_hours);
  return {
    full_name: row.full_name,
    staff_role: row.staff_role,
    position_title: profile.position_title ?? "",
    primary_clinic_id: profile.primary_clinic_id ?? "",
    email: row.email ?? "",
    mobile: row.mobile ?? "",
    default_timezone: row.default_timezone ?? "",
    calendar_color: row.calendar_color?.trim() || "#64748b",
    fi_user_id: row.fi_user_id ?? "",
    is_active: row.is_active ? "on" : "",
  };
}

export function StaffDirectoryClient({
  tenantId,
  data,
  showCrmNav,
  initialFilters,
}: {
  tenantId: string;
  data: StaffDirectoryPageResult;
  showCrmNav: boolean;
  initialFilters: StaffDirectoryFilterState;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [filters, setFilters] = useState<StaffDirectoryFilterState>(initialFilters);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [weekly, setWeekly] = useState<StaffWeeklyHoursMap>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editingRow = useMemo(
    () => (editingId ? data.staff.find((s) => s.id === editingId) ?? null : null),
    [editingId, data.staff]
  );

  const enrichedRows = useMemo(
    () => enrichStaffDirectoryRows(data.staff, data.payrollByStaffId, data.hrNotificationByStaffId),
    [data.staff, data.payrollByStaffId, data.hrNotificationByStaffId]
  );

  const visibleRows = useMemo(() => filterStaffDirectoryRows(enrichedRows, filters), [enrichedRows, filters]);

  const needsReviewCount = useMemo(() => enrichedRows.filter((r) => r.needsReview).length, [enrichedRows]);

  const hrSyncIssueCount = useMemo(
    () =>
      enrichedRows.filter(
        (r) =>
          detectStaffHrSyncIssues({
            staffId: r.id,
            fullName: r.full_name,
            email: r.email,
            hr: r.hrNotification,
          }).length > 0
      ).length,
    [enrichedRows]
  );

  const applyFilters = useCallback(
    (next: StaffDirectoryFilterState) => {
      setFilters(next);
      const q = buildStaffDirectorySearchParams(next);
      const qs = q.toString();
      router.replace(qs ? `${base}/staff?${qs}` : `${base}/staff`, { scroll: false });
    },
    [base, router]
  );

  const editingPayroll = editingRow ? data.payrollByStaffId[editingRow.id] ?? null : null;
  const editingHrNotification = editingRow
    ? data.hrNotificationByStaffId[editingRow.id] ?? enrichedRows.find((r) => r.id === editingRow.id)?.hrNotification
    : null;

  const canManage = data.canManageStaff;
  const viewerStaffId = data.viewerStaffId;
  const showTwinLinks = canManage || Boolean(viewerStaffId);

  const openCreate = () => {
    setError(null);
    setForm(emptyForm());
    setWeekly({});
    setEditingId(null);
    setMode("create");
  };

  const openEdit = (row: FiStaffRow) => {
    setError(null);
    setForm(rowToForm(row));
    setWeekly(parseStaffWeeklyHours(row.working_hours));
    setEditingId(row.id);
    setMode("edit");
  };

  const closePanel = () => {
    setMode("idle");
    setEditingId(null);
    setWeekly({});
    setError(null);
  };

  const onField = useCallback((key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const submit = () => {
    setError(null);
    const weeklyDoc = serializeStaffWeeklyHours(weekly);
    const working_hours = mergeStaffWorkingHoursDocument(
      weeklyDoc,
      {
        position_title: form.position_title.trim() || null,
        primary_clinic_id: form.primary_clinic_id.trim() || null,
      },
      mode === "edit" && editingRow ? editingRow.working_hours : null
    );
    const body = {
      full_name: form.full_name.trim(),
      staff_role: form.staff_role.trim() || "consultant",
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      default_timezone: form.default_timezone.trim() || null,
      calendar_color: form.calendar_color.trim() || null,
      fi_user_id: form.fi_user_id.trim() || null,
      is_active: form.is_active === "on",
      working_hours,
    };

    startTransition(async () => {
      if (mode === "create") {
        const r = await createStaffAction(tenantId, body);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        closePanel();
        router.refresh();
        return;
      }
      if (mode === "edit" && editingId) {
        const r = await updateStaffAction(tenantId, editingId, body);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        closePanel();
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">Staff</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Schedulable team members for the operational calendar. Link a row to <code className="text-xs">fi_users</code>{" "}
            when the person signs in; bookings can still assign staff without a login.
          </p>
          <p className="text-sm text-gray-600">
            <Link href={base} className="text-blue-600 hover:underline">
              ← Dashboard
            </Link>
            {canManage ? (
              <>
                <span className="mx-2 text-gray-300">·</span>
                <Link href={`${base}/hr/staff-import`} className="text-blue-600 hover:underline">
                  Staff import (HR)
                </Link>
                <span className="mx-2 text-gray-300">·</span>
                <Link href={`${base}/hr/staff-import/payroll`} className="text-blue-600 hover:underline">
                  Payroll import
                </Link>
                <span className="mx-2 text-gray-300">·</span>
                <Link href={`${base}/hr/staff-readiness`} className="text-blue-600 hover:underline">
                  Staff readiness
                </Link>
              </>
            ) : null}
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/calendar`} className="text-blue-600 hover:underline">
              Calendar
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/patients`} className="text-blue-600 hover:underline">
              Patients
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/staff-pin-login`} className="text-blue-600 hover:underline">
              Staff PIN login
            </Link>
            {showCrmNav ? (
              <>
                <span className="mx-2 text-gray-300">·</span>
                <Link href={`${base}/crm`} className="text-blue-600 hover:underline">
                  CRM
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={openCreate} className="shrink-0">
            Add staff
          </Button>
        ) : (
          <p className="text-xs text-gray-500">View only — admin or fi_admin can add or edit staff.</p>
        )}
      </header>

      {needsReviewCount > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            <strong>{needsReviewCount}</strong> staff member{needsReviewCount === 1 ? "" : "s"} still have role{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">needs_review</code> from payroll import. They appear in
            the directory but cannot be assigned to clinical bookings until you assign a role.
          </p>
          {canManage ? (
            <p className="mt-2">
              <button
                type="button"
                className="font-medium text-amber-900 underline-offset-2 hover:underline"
                onClick={() =>
                  applyFilters({
                    staffRole: NEEDS_REVIEW_STAFF_ROLE,
                    payrollOnly: false,
                    activeFilter: "all",
                  })
                }
              >
                Show role needs review
              </button>
              {" · "}
              <Link href={`${base}/staff/role-review`} className="font-medium text-amber-900 underline-offset-2 hover:underline">
                Assign roles workflow
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage && hrSyncIssueCount > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>
            <strong>{hrSyncIssueCount}</strong> active staff member{hrSyncIssueCount === 1 ? "" : "s"} have IIOHR HR
            sync gaps (missing link, stale metadata, or incomplete readiness fields).
          </p>
          <p className="mt-2">
            <Link href={`${base}/hr/sync-health`} className="font-medium text-amber-900 underline-offset-2 hover:underline">
              Open HR sync health dashboard
            </Link>
            {" · "}
            <Link href={`${base}/hr/staff-readiness`} className="font-medium text-amber-900 underline-offset-2 hover:underline">
              Staff readiness dashboard
            </Link>
          </p>
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Role
            <select
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={filters.staffRole ?? ""}
              onChange={(e) =>
                applyFilters({
                  ...filters,
                  staffRole: e.target.value.trim() || null,
                })
              }
            >
              <option value="">All roles</option>
              <option value={NEEDS_REVIEW_STAFF_ROLE}>Role needs review</option>
              {CLINICAL_STAFF_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 pb-1.5">
            <input
              type="checkbox"
              checked={filters.payrollOnly}
              onChange={(e) => applyFilters({ ...filters, payrollOnly: e.target.checked })}
            />
            Payroll imported
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Status
            <select
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={filters.activeFilter}
              onChange={(e) =>
                applyFilters({
                  ...filters,
                  activeFilter: e.target.value as StaffDirectoryFilterState["activeFilter"],
                })
              }
            >
              <option value="all">Active + inactive</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </label>
          <p className="text-xs text-gray-500 pb-1.5">
            Showing {visibleRows.length} of {enrichedRows.length}
            {filters.staffRole === NEEDS_REVIEW_STAFF_ROLE ? (
              <>
                {" "}
                ·{" "}
                <Link href={`${base}/staff/role-review`} className="text-blue-600 hover:underline">
                  Open assign roles workflow
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {(mode === "create" || mode === "edit") && canManage ? (
        <section
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          aria-label={mode === "create" ? "Add staff member" : "Edit staff member"}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">{mode === "create" ? "New staff" : "Edit staff"}</h2>
            <button type="button" onClick={closePanel} className="text-xs text-gray-600 hover:text-gray-900">
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-700">
              Full name
              <input
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.full_name}
                onChange={(e) => onField("full_name", e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Role
              <select
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm capitalize"
                value={form.staff_role}
                onChange={(e) => onField("staff_role", e.target.value)}
              >
                <option value={NEEDS_REVIEW_STAFF_ROLE}>needs review (payroll default)</option>
                {CLINICAL_STAFF_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {form.staff_role !== NEEDS_REVIEW_STAFF_ROLE &&
                !CLINICAL_STAFF_ROLE_OPTIONS.includes(form.staff_role as (typeof CLINICAL_STAFF_ROLE_OPTIONS)[number]) ? (
                  <option value={form.staff_role}>{form.staff_role}</option>
                ) : null}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Position / title
              <input
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.position_title}
                onChange={(e) => onField("position_title", e.target.value)}
                placeholder="e.g. Senior nurse, Clinic coordinator"
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Primary clinic
              <select
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.primary_clinic_id}
                onChange={(e) => onField("primary_clinic_id", e.target.value)}
              >
                <option value="">— None —</option>
                {data.clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Email
              <input
                type="email"
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.email}
                onChange={(e) => onField("email", e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Mobile
              <input
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.mobile}
                onChange={(e) => onField("mobile", e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Default timezone (IANA)
              <input
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.default_timezone}
                onChange={(e) => onField("default_timezone", e.target.value)}
                placeholder="Australia/Perth"
              />
            </label>
            <div className="sm:col-span-2">
              <StaffWeeklyHoursEditor value={weekly} onChange={setWeekly} />
            </div>
            <label className="block text-xs font-medium text-gray-700">
              Calendar colour
              <input
                type="color"
                className="mt-1 h-9 w-full max-w-[120px] cursor-pointer rounded border border-gray-300 bg-white"
                value={form.calendar_color?.startsWith("#") ? form.calendar_color : "#64748b"}
                onChange={(e) => onField("calendar_color", e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-gray-700 sm:col-span-2">
              Linked login user (optional)
              <select
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.fi_user_id}
                onChange={(e) => onField("fi_user_id", e.target.value)}
              >
                <option value="">— None —</option>
                {data.fiUsersForLink.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email?.trim() || u.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active === "on"}
                onChange={(e) => onField("is_active", e.target.checked ? "on" : "")}
              />
              Active (inactive staff cannot be assigned to new bookings; needs_review staff cannot be clinical providers)
            </label>
          </div>
          {mode === "edit" && editingHrNotification ? (
            <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
              <StaffHrNotificationDetailCard summary={editingHrNotification} variant="light" />
            </div>
          ) : null}
          {mode === "edit" && editingPayroll ? (
            <div className="mt-4">
              <StaffPayrollMetadataPanel payroll={editingPayroll} variant="light" />
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={pending || !form.full_name.trim()} onClick={submit}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel} disabled={pending}>
              Cancel
            </Button>
          </div>
          {mode === "edit" && editingRow ? (
            <>
              <p className="mt-2 text-xs text-gray-500">Staff id: {editingRow.id}</p>
              <div className="mt-4">
                <StaffPinSettingsPanel
                  tenantId={tenantId}
                  staffId={editingRow.id}
                  staffName={editingRow.full_name}
                  metadata={
                    data.pinMetadataByStaffId[editingRow.id] ?? {
                      staffId: editingRow.id,
                      status: "not_set",
                      isActive: false,
                      failedAttemptCount: 0,
                      lockedUntil: null,
                      lastUsedAt: null,
                      updatedAt: null,
                    }
                  }
                  onUpdated={() => router.refresh()}
                />
              </div>
              {data.canManageStaffFeatureVisibility ? (
                <StaffFeatureAccessPanel
                  tenantId={tenantId}
                  staffId={editingRow.id}
                  dbOverrides={data.staffFeatureAccessByStaffId[editingRow.id] ?? {}}
                />
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Colour
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Flags
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                HR
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Contact
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Timezone
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Weekly hours
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                Active
              </th>
              {canManage ? (
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                  PIN
                </th>
              ) : null}
              {showTwinLinks ? (
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                  Twin
                </th>
              ) : null}
              {canManage ? (
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500" scope="col">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={9 + (canManage ? 1 : 0) + (showTwinLinks ? 1 : 0) + (canManage ? 1 : 0)}
                  className="px-3 py-8 text-center text-gray-600"
                >
                  <p>{enrichedRows.length === 0 ? "No staff rows yet." : "No staff match the current filters."}</p>
                  <p className="mt-2 text-sm">
                    {canManage ? "Use Add staff to create the directory, or run " : "Ask an admin to add staff, or see "}
                    <Link href={`${base}/calendar/testing`} className="text-blue-600 hover:underline">
                      Calendar UAT
                    </Link>
                    {canManage ? " for a demo seed (dev / staging)." : " for setup guidance."}
                  </p>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.needsReview
                      ? "bg-amber-50/80"
                      : row.is_active
                        ? ""
                        : "bg-gray-50 text-gray-500"
                  }
                >
                  <td className="px-3 py-2">
                    <span
                      className="inline-block h-4 w-4 rounded border border-gray-200"
                      style={{ backgroundColor: row.calendar_color?.trim() || "#94a3b8" }}
                      title={row.calendar_color ?? ""}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    <div>{row.full_name}</div>
                    <div className="mt-0.5 text-xs capitalize text-gray-600">{row.staff_role}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.needsReview ? (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                          Needs review
                        </span>
                      ) : null}
                      {row.payrollImported ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
                          Payroll
                        </span>
                      ) : null}
                      {!row.is_active ? (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StaffHrNotificationBadge summary={row.hrNotification} compact />
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    <div>{row.email ?? "—"}</div>
                    {row.mobile ? <div className="text-xs text-gray-500">{row.mobile}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{row.default_timezone ?? "—"}</td>
                  <td className="max-w-[14rem] px-3 py-2 text-xs text-gray-700">
                    {formatStaffWeeklyHoursSummary(parseStaffWeeklyHours(row.working_hours)) || "—"}
                  </td>
                  <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
                  {canManage ? (
                    <td className="px-3 py-2 text-xs capitalize text-gray-700">
                      {data.pinMetadataByStaffId[row.id]?.status ?? "not_set"}
                    </td>
                  ) : null}
                  {showTwinLinks ? (
                    <td className="px-3 py-2">
                      {canManage || row.id === viewerStaffId ? (
                        <Link
                          href={`${base}/staff/${row.id}/twin`}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Open
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  ) : null}
                  {canManage ? (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:underline"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
