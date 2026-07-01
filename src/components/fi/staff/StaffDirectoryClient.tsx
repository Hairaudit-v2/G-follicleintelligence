"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import { createStaffAction, updateStaffAction } from "@/lib/actions/fi-staff-actions";
import { StaffFeatureAccessPanel } from "@/src/components/fi/staff/StaffFeatureAccessPanel";
import { StaffOrganisationalIntelligencePanel } from "@/src/components/fi/staff/StaffOrganisationalIntelligencePanel";
import { StaffHrNotificationDetailCard } from "@/src/components/fi/staff/StaffHrNotificationBadge";
import { StaffPayrollMetadataPanel } from "@/src/components/fi/staff/StaffPayrollMetadataPanel";
import { StaffPinSettingsPanel } from "@/src/components/fi/staff/StaffPinSettingsPanel";
import { StaffWeeklyHoursEditor } from "@/src/components/fi/staff/StaffWeeklyHoursEditor";
import { WorkforceCommandCentreView } from "@/src/components/fi/staff/WorkforceCommandCentreView";
import { detectStaffHrSyncIssues } from "@/src/lib/hr/hrStaffSyncHealthDashboard";
import type { StaffDirectoryPageResult } from "@/src/lib/staff/staffDirectoryLoader.server";
import {
  enrichStaffDirectoryRows,
  filterStaffDirectoryRows,
  type StaffDirectoryFilterState,
} from "@/src/lib/staff/staffDirectoryFilters";
import {
  mergeStaffWorkingHoursDocument,
  parseStaffProfileExtras,
} from "@/src/lib/staff/staffProfileExtras";
import {
  CLINICAL_STAFF_ROLE_OPTIONS,
  NEEDS_REVIEW_STAFF_ROLE,
} from "@/src/lib/staff/staffRolePolicy";
import type { FiStaffRow } from "@/src/lib/staff/staff.server";
import type { WorkforceRoleSegmentId } from "@/src/lib/staff/workforceCommandCentre";
import { parseExplicitWorkspaceProfile } from "@/src/lib/fi-os/workspaceProfileDerivation";
import {
  parseStaffWeeklyHours,
  serializeStaffWeeklyHours,
  type StaffWeeklyHoursMap,
} from "@/src/lib/staff/staffWeeklyHours";

type Mode = "idle" | "create" | "edit";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-white/[0.1] bg-[#0B1220] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#22C1FF]/40 focus:outline-none focus:ring-1 focus:ring-[#22C1FF]/30";
const labelClassName = "block text-xs font-medium text-[#94A3B8]";

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
  const [roleSegment, setRoleSegment] = useState<WorkforceRoleSegmentId>("all");
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [weekly, setWeekly] = useState<StaffWeeklyHoursMap>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editingRow = useMemo(
    () => (editingId ? (data.staff.find((s) => s.id === editingId) ?? null) : null),
    [editingId, data.staff]
  );

  const enrichedRows = useMemo(
    () => enrichStaffDirectoryRows(data.staff, data.payrollByStaffId, data.hrNotificationByStaffId),
    [data.staff, data.payrollByStaffId, data.hrNotificationByStaffId]
  );

  const visibleRows = useMemo(
    () => filterStaffDirectoryRows(enrichedRows, initialFilters),
    [enrichedRows, initialFilters]
  );

  const needsReviewCount = useMemo(
    () => enrichedRows.filter((r) => r.needsReview).length,
    [enrichedRows]
  );

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

  const editingPayroll = editingRow ? (data.payrollByStaffId[editingRow.id] ?? null) : null;
  const editingHrNotification = editingRow
    ? (data.hrNotificationByStaffId[editingRow.id] ??
      enrichedRows.find((r) => r.id === editingRow.id)?.hrNotification)
    : null;

  const canManage = data.canManageStaff;
  const viewerStaffId = data.viewerStaffId;
  const showTwinLinks = canManage || Boolean(viewerStaffId);
  const intelligenceByStaffId = data.workforceIntelligence?.perStaff ?? {};

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
      <WorkforceCommandCentreView
        base={base}
        canManage={canManage}
        showTwinLinks={showTwinLinks}
        viewerStaffId={viewerStaffId}
        allRows={enrichedRows}
        directoryRows={visibleRows}
        intelligenceByStaffId={intelligenceByStaffId}
        operationalMetrics={data.workforceOperationalMetrics}
        roleSegment={roleSegment}
        onRoleSegmentChange={setRoleSegment}
        onAddStaff={openCreate}
        onEditStaff={openEdit}
      />

      {needsReviewCount > 0 ? (
        <DashboardCard className="border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-sm text-amber-100">
            <strong>{needsReviewCount}</strong> staff member{needsReviewCount === 1 ? "" : "s"}{" "}
            still have role{" "}
            <code className="rounded bg-amber-500/20 px-1 text-xs">needs_review</code> from payroll
            import.
          </p>
          {canManage ? (
            <p className="mt-2 text-sm">
              <Link
                href={`${base}/staff/role-review`}
                className="font-medium text-amber-200 hover:underline"
              >
                Assign roles workflow
              </Link>
            </p>
          ) : null}
        </DashboardCard>
      ) : null}

      {canManage && hrSyncIssueCount > 0 ? (
        <DashboardCard className="border-amber-500/25 bg-amber-500/[0.06] p-4">
          <p className="text-sm text-amber-100">
            <strong>{hrSyncIssueCount}</strong> active staff member
            {hrSyncIssueCount === 1 ? "" : "s"} have IIOHR HR sync gaps.
          </p>
          <p className="mt-2 text-sm">
            <Link
              href={`${base}/hr/sync-health`}
              className="font-medium text-amber-200 hover:underline"
            >
              Open HR sync health dashboard
            </Link>
          </p>
        </DashboardCard>
      ) : null}

      {showCrmNav ? (
        <p className="text-xs text-[#64748B]">
          <Link href={`${base}/crm`} className="text-[#22C1FF] hover:underline">
            CRM
          </Link>
          {" · "}
          <Link href={`${base}/calendar`} className="text-[#22C1FF] hover:underline">
            Calendar
          </Link>
          {" · "}
          <Link href={`${base}/staff-pin-login`} className="text-[#22C1FF] hover:underline">
            Staff PIN login
          </Link>
        </p>
      ) : null}

      {error ? (
        <div
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {(mode === "create" || mode === "edit") && canManage ? (
        <DashboardCard
          className="p-4 sm:p-5"
          elevated
          aria-label={mode === "create" ? "Add staff member" : "Edit staff member"}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#F8FAFC]">
              {mode === "create" ? "New staff" : "Edit staff"}
            </h2>
            <button
              type="button"
              onClick={closePanel}
              className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Full name
              <input
                className={inputClassName}
                value={form.full_name}
                onChange={(e) => onField("full_name", e.target.value)}
                required
              />
            </label>
            <label className={labelClassName}>
              Role
              <select
                className={inputClassName}
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
                !CLINICAL_STAFF_ROLE_OPTIONS.includes(
                  form.staff_role as (typeof CLINICAL_STAFF_ROLE_OPTIONS)[number]
                ) ? (
                  <option value={form.staff_role}>{form.staff_role}</option>
                ) : null}
              </select>
            </label>
            <label className={labelClassName}>
              Position / title
              <input
                className={inputClassName}
                value={form.position_title}
                onChange={(e) => onField("position_title", e.target.value)}
                placeholder="e.g. Senior nurse, Clinic coordinator"
              />
            </label>
            <label className={labelClassName}>
              Primary clinic
              <select
                className={inputClassName}
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
            <label className={labelClassName}>
              Email
              <input
                type="email"
                className={inputClassName}
                value={form.email}
                onChange={(e) => onField("email", e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Mobile
              <input
                className={inputClassName}
                value={form.mobile}
                onChange={(e) => onField("mobile", e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Default timezone (IANA)
              <input
                className={inputClassName}
                value={form.default_timezone}
                onChange={(e) => onField("default_timezone", e.target.value)}
                placeholder="Australia/Perth"
              />
            </label>
            <div className="sm:col-span-2">
              <StaffWeeklyHoursEditor value={weekly} onChange={setWeekly} />
            </div>
            <label className={labelClassName}>
              Calendar colour
              <input
                type="color"
                className="mt-1 h-9 w-full max-w-[120px] cursor-pointer rounded-lg border border-white/[0.1] bg-[#0B1220]"
                value={form.calendar_color?.startsWith("#") ? form.calendar_color : "#64748b"}
                onChange={(e) => onField("calendar_color", e.target.value)}
              />
            </label>
            <label className={`${labelClassName} sm:col-span-2`}>
              Linked login user (optional)
              <select
                className={inputClassName}
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
            <label className="flex items-center gap-2 text-sm text-[#CBD5E1] sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active === "on"}
                onChange={(e) => onField("is_active", e.target.checked ? "on" : "")}
              />
              Active (inactive staff cannot be assigned to new bookings)
            </label>
          </div>
          {mode === "edit" && editingHrNotification ? (
            <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#0B1220]/60 p-3">
              <StaffHrNotificationDetailCard summary={editingHrNotification} variant="dark" />
            </div>
          ) : null}
          {mode === "edit" && editingPayroll ? (
            <div className="mt-4">
              <StaffPayrollMetadataPanel payroll={editingPayroll} variant="dark" />
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
              {data.canViewStaffOrganisationalIntelligence &&
              editingRow &&
              data.staffOrganisationalIntelligenceByStaffId[editingRow.id] ? (
                <StaffOrganisationalIntelligencePanel
                  intel={data.staffOrganisationalIntelligenceByStaffId[editingRow.id]}
                />
              ) : null}
              {data.canManageStaffFeatureVisibility ? (
                <StaffFeatureAccessPanel
                  tenantId={tenantId}
                  staffId={editingRow.id}
                  dbOverrides={data.staffFeatureAccessByStaffId[editingRow.id] ?? {}}
                  featureTemplateDefaults={
                    data.staffFeatureTemplateDefaultsByStaffId[editingRow.id] ?? {}
                  }
                  staffPositionTypeId={editingRow.position_type_id}
                  positionTypes={data.staffPositionTypes.map((p) => ({
                    id: p.id,
                    tenant_id: p.tenant_id,
                    code: p.code,
                    title: p.title,
                    default_workspace_profile: p.default_workspace_profile,
                    default_feature_template_key: p.default_feature_template_key,
                  }))}
                  initialExplicitWorkspaceProfile={parseExplicitWorkspaceProfile(
                    editingRow.staff_metadata.workspace_profile
                  )}
                />
              ) : null}
            </>
          ) : null}
        </DashboardCard>
      ) : null}
    </div>
  );
}
