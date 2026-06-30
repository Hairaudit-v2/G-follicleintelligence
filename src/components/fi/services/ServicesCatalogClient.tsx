"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createServiceAction,
  deactivateServiceAction,
  loadDefaultClinicServicesAction,
  updateServiceAction,
} from "@/lib/actions/fi-services-actions";
import {
  saveServiceRoomEligibilityAction,
  saveServiceStaffEligibilityAction,
} from "@/lib/actions/fi-rooms-actions";
import { DEFAULT_CLINIC_SERVICE_LIBRARY } from "@/src/lib/services/defaultClinicServices";
import { BOOKING_TYPES } from "@/src/lib/bookings/bookingPolicy";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { formatPriceAud } from "@/src/lib/bookings/servicesCatalog";
import type { ServicesCatalogPageResult } from "@/src/lib/services/servicesCatalogLoader.server";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

type Mode = "idle" | "create" | "edit";

function emptyForm(): Record<string, string> {
  return {
    name: "",
    duration_minutes: "30",
    base_price: "0",
    color: "#0ea5e9",
    category: "",
    booking_type: "",
    is_active: "on",
  };
}

function rowToForm(row: FiServiceRow): Record<string, string> {
  return {
    name: row.name,
    duration_minutes: String(row.duration_minutes),
    base_price: String(row.base_price),
    color: row.color?.trim() || "#64748b",
    category: row.category ?? "",
    booking_type: row.booking_type?.trim() ?? "",
    is_active: row.is_active ? "on" : "",
  };
}

export function ServicesCatalogClient({
  tenantId,
  data,
  showCrmNav,
}: {
  tenantId: string;
  data: ServicesCatalogPageResult;
  showCrmNav: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [eligibleRoomIds, setEligibleRoomIds] = useState<string[]>([]);
  const [preferredRoomId, setPreferredRoomId] = useState<string>("");
  const [staffRoles, setStaffRoles] = useState<string>("");

  const canManage = data.canManageServices;
  const showEmptyCatalogBanner = data.activeServiceCount === 0;

  const openCreate = () => {
    setError(null);
    setForm(emptyForm());
    setEditingId(null);
    setMode("create");
  };

  const openEdit = (row: FiServiceRow) => {
    setError(null);
    setForm(rowToForm(row));
    setEditingId(row.id);
    setEligibleRoomIds(data.roomEligibilityByServiceId[row.id] ?? []);
    setPreferredRoomId(data.preferredRoomByServiceId[row.id] ?? "");
    setStaffRoles((data.staffRolesByServiceId[row.id] ?? []).join(", "));
    setMode("edit");
  };

  const closePanel = () => {
    setMode("idle");
    setEditingId(null);
    setError(null);
  };

  const onField = useCallback((key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const deactivateRow = (row: FiServiceRow) => {
    if (!window.confirm(`Deactivate “${row.name}”? It will stay in the catalogue as inactive.`))
      return;
    setError(null);
    startTransition(async () => {
      const r = await deactivateServiceAction(tenantId, row.id, {});
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const activateRow = (row: FiServiceRow) => {
    setError(null);
    startTransition(async () => {
      const r = await updateServiceAction(tenantId, row.id, { is_active: true });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const loadDefaults = () => {
    setError(null);
    setSeedMessage(null);
    startTransition(async () => {
      const r = await loadDefaultClinicServicesAction(tenantId, {});
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const parts = [`${r.created} created`];
      if (r.updated) parts.push(`${r.updated} updated`);
      if (r.skipped) parts.push(`${r.skipped} unchanged`);
      setSeedMessage(
        `Default clinic services loaded (${parts.join(", ")}). Existing prices were kept.`
      );
      router.refresh();
    });
  };

  const submit = () => {
    setError(null);
    const duration = Number.parseInt(form.duration_minutes, 10);
    const price = Number.parseFloat(form.base_price);
    const bookingType = form.booking_type.trim();

    const body = {
      name: form.name.trim(),
      duration_minutes: duration,
      base_price: Number.isFinite(price) ? price : 0,
      color: form.color.trim() || null,
      category: form.category.trim() || null,
      is_active: form.is_active === "on",
      booking_type: bookingType ? bookingType : null,
    };

    startTransition(async () => {
      if (mode === "create") {
        const r = await createServiceAction(tenantId, body);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        closePanel();
        router.refresh();
        return;
      }
      if (mode === "edit" && editingId) {
        const r = await updateServiceAction(tenantId, editingId, body);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const roomRows = eligibleRoomIds.map((roomId) => ({
          roomId,
          isPreferred: preferredRoomId === roomId,
          isActive: true,
        }));
        const staffRows = staffRoles
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((staffRole) => ({ staffRole, isActive: true }));
        await saveServiceRoomEligibilityAction(tenantId, editingId, { rows: roomRows });
        await saveServiceStaffEligibilityAction(tenantId, editingId, { rows: staffRows });
        closePanel();
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-100">Services</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Procedure catalog: default duration, price suggestion, and calendar colour per booking
            type. When <span className="font-medium">Procedure type</span> is set, that row defines
            the catalog for that type (one per tenant).
          </p>
          <p className="text-sm text-slate-400">
            <Link href={base} className="text-blue-300 hover:underline">
              ← Dashboard
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/calendar`} className="text-blue-300 hover:underline">
              Calendar
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`${base}/staff`} className="text-blue-300 hover:underline">
              Staff
            </Link>
            {showCrmNav ? (
              <>
                <span className="mx-2 text-gray-300">·</span>
                <Link href={`${base}/crm`} className="text-blue-300 hover:underline">
                  CRM
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={loadDefaults} disabled={pending}>
              Load Default Clinic Services
            </Button>
            <Button type="button" onClick={openCreate} disabled={pending}>
              Add service
            </Button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            View only — tenant admin, platform FI OS admin, or valid admin API access can edit the
            catalogue.
          </p>
        )}
      </header>

      {showEmptyCatalogBanner ? (
        <div
          className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
          role="status"
        >
          <p className="font-medium">No active services in your catalog</p>
          <p className="mt-1 text-amber-200">
            Calendar and bookings still work with built-in fallbacks, but procedure colours,
            durations, and price hints work best with a service library. Load the{" "}
            {DEFAULT_CLINIC_SERVICE_LIBRARY.length} Evolved defaults or add your own rows.
          </p>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={loadDefaults}
              disabled={pending}
            >
              Load Default Clinic Services
            </Button>
          ) : null}
        </div>
      ) : null}

      {seedMessage ? (
        <div
          className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
          role="status"
        >
          {seedMessage}
        </div>
      ) : null}

      {error ? (
        <div
          className="rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {(mode === "create" || mode === "edit") && canManage ? (
        <section
          className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40"
          aria-label={mode === "create" ? "Add service" : "Edit service"}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">
              {mode === "create" ? "New service" : "Edit service"}
            </h2>
            <button
              type="button"
              onClick={closePanel}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
              Name
              <input
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => onField("name", e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Duration (minutes)
              <input
                type="number"
                min={1}
                max={1440}
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                value={form.duration_minutes}
                onChange={(e) => onField("duration_minutes", e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Base price (AUD)
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                value={form.base_price}
                onChange={(e) => onField("base_price", e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Colour (hex)
              <input
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm font-mono"
                value={form.color}
                onChange={(e) => onField("color", e.target.value)}
                placeholder="#0ea5e9"
              />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Category
              <input
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                value={form.category}
                onChange={(e) => onField("category", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
              Procedure type (optional — links to booking type)
              <select
                className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                value={form.booking_type}
                onChange={(e) => onField("booking_type", e.target.value)}
              >
                <option value="">None (custom listing only)</option>
                {BOOKING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {bookingTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active === "on"}
                onChange={(e) => onField("is_active", e.target.checked ? "on" : "")}
              />
              Active
            </label>
          </div>
          {mode === "edit" ? (
            <div className="mt-4 space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Scheduling eligibility
              </p>
              {data.rooms.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No rooms configured. Add rooms in{" "}
                  <Link href={`${base}/rooms`} className="text-cyan-300 underline">
                    Settings → Rooms
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.rooms.map((room) => (
                    <label key={room.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={eligibleRoomIds.includes(room.id)}
                        onChange={(e) => {
                          setEligibleRoomIds((ids) =>
                            e.target.checked
                              ? [...ids, room.id]
                              : ids.filter((id) => id !== room.id)
                          );
                          if (!e.target.checked && preferredRoomId === room.id)
                            setPreferredRoomId("");
                        }}
                      />
                      {room.display_name}
                    </label>
                  ))}
                </div>
              )}
              {eligibleRoomIds.length > 0 ? (
                <label className="block text-xs font-medium text-slate-300">
                  Preferred room
                  <select
                    className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                    value={preferredRoomId}
                    onChange={(e) => setPreferredRoomId(e.target.value)}
                  >
                    <option value="">None</option>
                    {eligibleRoomIds.map((id) => {
                      const room = data.rooms.find((r) => r.id === id);
                      return (
                        <option key={id} value={id}>
                          {room?.display_name ?? id}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}
              <label className="block text-xs font-medium text-slate-300">
                Eligible staff roles (comma-separated)
                <input
                  className="mt-1 block w-full rounded border border-slate-700 px-2 py-1.5 text-sm"
                  value={staffRoles}
                  onChange={(e) => setStaffRoles(e.target.value)}
                  placeholder="consultant, nurse, doctor, technician"
                />
              </label>
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={submit} disabled={pending || !form.name.trim()}>
              {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={closePanel} disabled={pending}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
        <table className="min-w-full divide-y divide-white/[0.08] text-sm">
          <thead className="bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Colour</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {data.services.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  <p>No services in the catalog yet.</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {canManage
                      ? "Add the first row to drive booking durations and colours, or use "
                      : "See "}
                    <Link
                      href={`${base}/calendar/testing`}
                      className="text-blue-300 hover:underline"
                    >
                      Calendar UAT
                    </Link>
                    {canManage
                      ? " for optional demo services (dev / staging)."
                      : " for setup guidance."}
                  </p>
                </td>
              </tr>
            ) : (
              data.services.map((row) => (
                <tr key={row.id} className={cn(!row.is_active && "bg-white/[0.03] text-gray-500")}>
                  <td className="px-3 py-2 font-medium text-slate-100">{row.name}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {row.booking_type ? bookingTypeLabel(row.booking_type) : "—"}
                  </td>
                  <td className="px-3 py-2">{row.duration_minutes} min</td>
                  <td className="px-3 py-2">{formatPriceAud(row.base_price)}</td>
                  <td className="px-3 py-2">
                    {row.color ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-4 w-4 rounded border border-slate-700"
                          style={{ backgroundColor: row.color }}
                          title={row.color}
                        />
                        <span className="font-mono text-xs">{row.color}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{row.category ?? "—"}</td>
                  <td className="px-3 py-2">{row.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-3 py-2 text-right">
                    {canManage ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                        <button
                          type="button"
                          className="text-blue-300 hover:underline disabled:opacity-50"
                          disabled={pending}
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                        {row.is_active ? (
                          <button
                            type="button"
                            className="text-amber-300 hover:underline disabled:opacity-50"
                            disabled={pending}
                            onClick={() => deactivateRow(row)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-blue-300 hover:underline disabled:opacity-50"
                            disabled={pending}
                            onClick={() => activateRow(row)}
                          >
                            Activate
                          </button>
                        )}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
