"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClinicRoomAction, loadRoomsCatalogAction, updateClinicRoomAction } from "@/lib/actions/fi-rooms-actions";
import { CLINIC_ROOM_TYPES, type ClinicRoomType, type FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";

type Mode = "idle" | "create" | "edit";

function emptyForm(clinicId: string): Record<string, string> {
  return {
    clinicId,
    roomCode: "",
    displayName: "",
    physicalRoomKey: "",
    roomType: "consult",
    capabilities: "",
    sortOrder: "0",
    isActive: "on",
  };
}

function rowToForm(row: FiClinicRoomRow): Record<string, string> {
  return {
    clinicId: row.clinic_id,
    roomCode: row.room_code,
    displayName: row.display_name,
    physicalRoomKey: row.physical_room_key,
    roomType: row.room_type,
    capabilities: row.capabilities.join(", "),
    sortOrder: String(row.sort_order),
    isActive: row.is_active ? "on" : "",
  };
}

export function RoomsCatalogClient({
  tenantId,
  initialRooms,
  clinics,
  canManage,
  showCrmNav,
}: {
  tenantId: string;
  initialRooms: FiClinicRoomRow[];
  clinics: CrmShellClinicOption[];
  canManage: boolean;
  showCrmNav: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}`;
  const [rooms, setRooms] = useState(initialRooms);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm(clinics[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clinicName = (id: string) => clinics.find((c) => c.id === id)?.display_name ?? id.slice(0, 8);

  const refresh = useCallback(() => {
    startTransition(async () => {
      const r = await loadRoomsCatalogAction(tenantId);
      if (r.ok) setRooms(r.rooms);
    });
  }, [tenantId]);

  const openCreate = () => {
    setError(null);
    setForm(emptyForm(clinics[0]?.id ?? ""));
    setEditingId(null);
    setMode("create");
  };

  const openEdit = (row: FiClinicRoomRow) => {
    setError(null);
    setForm(rowToForm(row));
    setEditingId(row.id);
    setMode("edit");
  };

  const onField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    setError(null);
    const payload = {
      clinicId: form.clinicId.trim(),
      roomCode: form.roomCode.trim(),
      displayName: form.displayName.trim(),
      physicalRoomKey: form.physicalRoomKey.trim(),
      roomType: form.roomType.trim() as ClinicRoomType,
      capabilities: form.capabilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive === "on",
    };
    startTransition(async () => {
      const r =
        mode === "edit" && editingId
          ? await updateClinicRoomAction(tenantId, editingId, payload)
          : await createClinicRoomAction(tenantId, payload);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMode("idle");
      refresh();
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settings</p>
          <h1 className="text-2xl font-semibold text-slate-100">Rooms</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Manage bookable clinic rooms. Rooms sharing the same physical key cannot overlap in time.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={openCreate} disabled={!clinics.length || pending}>
            Add room
          </Button>
        ) : null}
      </div>

      {showCrmNav ? (
        <p className="text-xs text-slate-500">
          <Link href={`${base}/services`} className="text-cyan-400 hover:underline">
            Services
          </Link>
          {" · assign eligible rooms per service in the service editor."}
        </p>
      ) : null}

      {!clinics.length ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Add a clinic in Configuration before creating rooms.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
        <table className="min-w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Physical key</th>
              <th className="px-4 py-3">Status</th>
              {canManage ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {rooms.map((row) => (
              <tr key={row.id} className="border-b border-white/[0.06] text-slate-200">
                <td className="px-4 py-3 font-medium">{row.display_name}</td>
                <td className="px-4 py-3 text-slate-400">{clinicName(row.clinic_id)}</td>
                <td className="px-4 py-3 capitalize">{row.room_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.physical_room_key}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", row.is_active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-500/20 text-slate-400")}>
                    {row.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                {canManage ? (
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-cyan-400 hover:underline" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {!rooms.length ? (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                  No rooms yet. Perth seed runs automatically when Evolved Perth clinic exists.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {mode !== "idle" ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <h2 className="text-lg font-semibold text-slate-100">{mode === "create" ? "New room" : "Edit room"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-400">
              Clinic
              <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.clinicId} onChange={(e) => onField("clinicId", e.target.value)}>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Room code
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.roomCode} onChange={(e) => onField("roomCode", e.target.value)} />
            </label>
            <label className="block text-xs text-slate-400">
              Display name
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.displayName} onChange={(e) => onField("displayName", e.target.value)} />
            </label>
            <label className="block text-xs text-slate-400">
              Physical room key
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-mono" value={form.physicalRoomKey} onChange={(e) => onField("physicalRoomKey", e.target.value)} />
            </label>
            <label className="block text-xs text-slate-400">
              Room type
              <select className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.roomType} onChange={(e) => onField("roomType", e.target.value)}>
                {CLINIC_ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Sort order
              <input type="number" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => onField("sortOrder", e.target.value)} />
            </label>
            <label className="block text-xs text-slate-400 sm:col-span-2">
              Capabilities (comma-separated)
              <input className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={form.capabilities} onChange={(e) => onField("capabilities", e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isActive === "on"} onChange={(e) => onField("isActive", e.target.checked ? "on" : "")} />
              Active
            </label>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={save} disabled={pending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
