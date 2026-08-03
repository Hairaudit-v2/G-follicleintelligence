"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SystemAuditEventList } from "@/src/components/system-audit/SystemAuditEventList";
import type { SystemAuditEventRow } from "@/src/lib/systemAudit/systemAuditTypes";
import { SYSTEM_AUDIT_ACTIONS } from "@/src/lib/systemAudit/systemAuditTypes";

export function SystemAuditAdminClient({
  tenantId,
  events,
  filters,
}: {
  tenantId: string;
  events: SystemAuditEventRow[];
  filters: {
    from: string;
    to: string;
    action: string;
    entityType: string;
    actorUserId: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (!v.trim()) next.delete(k);
        else next.set(k, v.trim());
      }
      startTransition(() => {
        router.push(`/fi-admin/${tenantId}/reports/system-audit?${next.toString()}`);
      });
    },
    [router, searchParams, tenantId]
  );

  return (
    <div className="space-y-4" data-testid="system-audit-admin">
      <form
        className="grid gap-3 rounded-xl border border-white/[0.08] bg-[#0F1629]/60 p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          apply({
            from: String(fd.get("from") ?? ""),
            to: String(fd.get("to") ?? ""),
            action: String(fd.get("action") ?? ""),
            entityType: String(fd.get("entityType") ?? ""),
            actor: String(fd.get("actor") ?? ""),
          });
        }}
      >
        <label className="text-xs text-slate-400">
          From
          <input
            name="from"
            type="date"
            defaultValue={filters.from}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#020617] px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input
            name="to"
            type="date"
            defaultValue={filters.to}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#020617] px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          Action
          <select
            name="action"
            defaultValue={filters.action}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#020617] px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="">All actions</option>
            {SYSTEM_AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Entity type
          <input
            name="entityType"
            type="text"
            placeholder="patient, payment_record…"
            defaultValue={filters.entityType}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#020617] px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          Actor user id
          <input
            name="actor"
            type="text"
            placeholder="uuid"
            defaultValue={filters.actorUserId}
            className="mt-1 w-full rounded-md border border-white/10 bg-[#020617] px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm" disabled={pending} className="bg-cyan-600 text-white hover:bg-cyan-500">
            {pending ? "Filtering…" : "Apply filters"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="border-white/15 text-slate-200"
            onClick={() => apply({ from: "", to: "", action: "", entityType: "", actor: "" })}
          >
            Clear
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/75 p-4">
        <p className="mb-3 text-xs text-slate-500">
          Showing {events.length} event{events.length === 1 ? "" : "s"} (tenant-scoped, newest first).
        </p>
        <SystemAuditEventList events={events} />
      </div>
    </div>
  );
}
