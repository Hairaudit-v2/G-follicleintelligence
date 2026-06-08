"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createStaffAction, updateStaffAction } from "@/lib/actions/fi-staff-actions";
import { StaffWeeklyHoursEditor } from "@/src/components/fi/staff/StaffWeeklyHoursEditor";
import type { StaffDirectoryPageResult } from "@/src/lib/staff/staffDirectoryLoader.server";
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
    email: "",
    mobile: "",
    default_timezone: "",
    calendar_color: "#0ea5e9",
    fi_user_id: "",
    is_active: "on",
  };
}

function rowToForm(row: FiStaffRow): Record<string, string> {
  return {
    full_name: row.full_name,
    staff_role: row.staff_role,
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
}: {
  tenantId: string;
  data: StaffDirectoryPageResult;
  showCrmNav: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
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
    const body = {
      full_name: form.full_name.trim(),
      staff_role: form.staff_role.trim() || "consultant",
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      default_timezone: form.default_timezone.trim() || null,
      calendar_color: form.calendar_color.trim() || null,
      fi_user_id: form.fi_user_id.trim() || null,
      is_active: form.is_active === "on",
      working_hours: serializeStaffWeeklyHours(weekly),
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
              <input
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={form.staff_role}
                onChange={(e) => onField("staff_role", e.target.value)}
                placeholder="surgeon, consultant, nurse…"
              />
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
              Active (inactive staff cannot be assigned to new bookings)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={pending || !form.full_name.trim()} onClick={submit}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel} disabled={pending}>
              Cancel
            </Button>
          </div>
          {mode === "edit" && editingRow ? (
            <p className="mt-2 text-xs text-gray-500">Staff id: {editingRow.id}</p>
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
                Role
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
            {data.staff.length === 0 ? (
              <tr>
                <td colSpan={7 + (showTwinLinks ? 1 : 0) + (canManage ? 1 : 0)} className="px-3 py-8 text-center text-gray-600">
                  <p>No staff rows yet.</p>
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
              data.staff.map((row) => (
                <tr key={row.id} className={row.is_active ? "" : "bg-gray-50 text-gray-500"}>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block h-4 w-4 rounded border border-gray-200"
                      style={{ backgroundColor: row.calendar_color?.trim() || "#94a3b8" }}
                      title={row.calendar_color ?? ""}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{row.full_name}</td>
                  <td className="px-3 py-2 capitalize text-gray-700">{row.staff_role}</td>
                  <td className="px-3 py-2 text-gray-700">
                    <div>{row.email ?? "—"}</div>
                    {row.mobile ? <div className="text-xs text-gray-500">{row.mobile}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{row.default_timezone ?? "—"}</td>
                  <td className="max-w-[14rem] px-3 py-2 text-xs text-gray-700">
                    {formatStaffWeeklyHoursSummary(parseStaffWeeklyHours(row.working_hours)) || "—"}
                  </td>
                  <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
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
