"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  archivePlatformTenantAction,
  loadTenantDependencyAuditAction,
  restorePlatformTenantAction,
} from "@/lib/actions/fi-platform-tenant-lifecycle-actions";
import type { FiPlatformTenantLifecycleRow } from "@/src/lib/fiOs/platformTenantLifecycleCore";
import {
  groupPlatformTenantsForAdminUi,
  shouldShowTenantHomeLink,
  tenantLifecycleBadges,
} from "@/src/lib/fiOs/platformTenantLifecycleCore";
import type { FiTenantDependencyCounts } from "@/src/lib/fiOs/platformTenantDependencyAudit.server";

type Props = {
  tenants: FiPlatformTenantLifecycleRow[];
  sessionActiveTenantId?: string | null;
};

function badgeClass(label: string): string {
  if (label === "Archived") return "bg-slate-700/80 text-slate-300";
  if (label === "Demo" || label === "Sandbox") return "bg-amber-900/40 text-amber-200";
  return "bg-slate-800 text-slate-400";
}

function TenantBadges({ tenant }: { tenant: FiPlatformTenantLifecycleRow }) {
  const badges = tenantLifecycleBadges(tenant);
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(b)}`}
        >
          {b}
        </span>
      ))}
    </span>
  );
}

function DependencySummary({ counts }: { counts: FiTenantDependencyCounts }) {
  const entries: Array<[string, number]> = [
    ["Clinics", counts.clinics],
    ["Staff", counts.staff],
    ["Doctors", counts.doctors],
    ["Patients", counts.patients],
    ["Consultations", counts.consultations],
    ["Cases", counts.cases],
    ["Protocol sessions", counts.protocolSessions],
    ["Patient images", counts.patientImages],
    ["Payments", counts.paymentRecords],
    ["Calendar events", counts.calendarEvents],
    ["Onboarding sessions", counts.provisioningSessions],
    ["Audit events", counts.auditEvents],
    ["FI users", counts.fiUsers],
    ["Tenant admins", counts.tenantAdminUsers],
  ];
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400 sm:grid-cols-3">
      {entries.map(([label, n]) => (
        <div key={label} className="flex justify-between gap-2">
          <dt>{label}</dt>
          <dd className="font-mono text-slate-300">{n}</dd>
        </div>
      ))}
    </dl>
  );
}

function TenantRow({
  tenant,
  sessionActiveTenantId,
  onMutated,
}: {
  tenant: FiPlatformTenantLifecycleRow;
  sessionActiveTenantId?: string | null;
  onMutated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [reason, setReason] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [dependencyCounts, setDependencyCounts] = useState<FiTenantDependencyCounts | null>(null);
  const [totalLinked, setTotalLinked] = useState<number | null>(null);

  const archived = Boolean(tenant.archived_at);
  const showHome = shouldShowTenantHomeLink(tenant);

  async function loadAudit() {
    setAuditLoading(true);
    setMessage(null);
    const res = await loadTenantDependencyAuditAction({ tenantId: tenant.id });
    setAuditLoading(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setDependencyCounts(res.audit.counts);
    setTotalLinked(res.audit.totalLinkedRecords);
  }

  function onArchiveClick() {
    setShowArchive(true);
    void loadAudit();
  }

  function onConfirmArchive() {
    setMessage(null);
    startTransition(async () => {
      const res = await archivePlatformTenantAction({
        tenantId: tenant.id,
        reason,
        sessionActiveTenantId,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setShowArchive(false);
      setReason("");
      onMutated();
      router.refresh();
    });
  }

  function onRestore() {
    setMessage(null);
    startTransition(async () => {
      const res = await restorePlatformTenantAction({ tenantId: tenant.id });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      onMutated();
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-100">{tenant.name}</p>
            <TenantBadges tenant={tenant} />
          </div>
          <p className="text-xs text-slate-500">
            <span className="font-mono">{tenant.slug}</span>
            {tenant.created_at ? (
              <span className="text-slate-600"> · {tenant.created_at.slice(0, 10)}</span>
            ) : null}
          </p>
          {archived && tenant.archive_reason ? (
            <p className="text-xs text-slate-500">Archive reason: {tenant.archive_reason}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showHome ? (
            <Link
              href={`/fi-admin/${tenant.id}`}
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              Tenant home →
            </Link>
          ) : null}
          {archived ? (
            <button
              type="button"
              disabled={pending}
              onClick={onRestore}
              className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onArchiveClick}
              className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950/30 disabled:opacity-50"
            >
              Archive…
            </button>
          )}
        </div>
      </div>

      {message ? (
        <p className="mt-2 text-xs text-red-400" role="status">
          {message}
        </p>
      ) : null}

      {showArchive ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/10 p-3">
          <p className="text-xs font-semibold text-amber-100">Archive safety check</p>
          <p className="mt-1 text-xs text-slate-400">
            Archiving hides the tenant from default lists. No data is deleted. Review linked records
            before confirming.
          </p>
          {auditLoading ? (
            <p className="mt-2 text-xs text-slate-500">Loading dependency counts…</p>
          ) : dependencyCounts ? (
            <>
              <p className="mt-2 text-xs text-slate-300">
                Total linked records:{" "}
                <span className="font-mono">{totalLinked ?? 0}</span>
              </p>
              <DependencySummary counts={dependencyCounts} />
            </>
          ) : null}
          <label className="mt-3 block">
            <span className="text-xs font-medium text-slate-400">Archive reason</span>
            <textarea
              required
              rows={2}
              className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#030810] px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/30 focus:ring-2"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="e.g. Demo tenant superseded by evolved-hair production tenant"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || reason.trim().length < 3}
              onClick={onConfirmArchive}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Confirm archive
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowArchive(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function TenantSection({
  title,
  tenants,
  sessionActiveTenantId,
  onMutated,
}: {
  title: string;
  tenants: FiPlatformTenantLifecycleRow[];
  sessionActiveTenantId?: string | null;
  onMutated: () => void;
}) {
  if (tenants.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-200">
        {title} ({tenants.length})
      </h2>
      <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
        {tenants.map((t) => (
          <TenantRow
            key={t.id}
            tenant={t}
            sessionActiveTenantId={sessionActiveTenantId}
            onMutated={onMutated}
          />
        ))}
      </ul>
    </div>
  );
}

export function PlatformTenantsListClient({ tenants, sessionActiveTenantId }: Props) {
  const [showDemo, setShowDemo] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [, setTick] = useState(0);

  const groups = groupPlatformTenantsForAdminUi(tenants);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex cursor-pointer items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={showDemo}
            onChange={(ev) => setShowDemo(ev.target.checked)}
            className="rounded border-white/20"
          />
          Show demo / sandbox tenants
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(ev) => setShowArchived(ev.target.checked)}
            className="rounded border-white/20"
          />
          Show archived tenants
        </label>
      </div>

      <TenantSection
        title="Production tenants"
        tenants={groups.production}
        sessionActiveTenantId={sessionActiveTenantId}
        onMutated={() => setTick((n) => n + 1)}
      />

      {showDemo ? (
        <TenantSection
          title="Demo / sandbox tenants"
          tenants={groups.demo}
          sessionActiveTenantId={sessionActiveTenantId}
          onMutated={() => setTick((n) => n + 1)}
        />
      ) : groups.demo.length > 0 ? (
        <p className="text-xs text-slate-500">
          {groups.demo.length} demo / sandbox tenant(s) hidden. Enable the toggle above to manage
          them.
        </p>
      ) : null}

      {showArchived ? (
        <TenantSection
          title="Archived tenants"
          tenants={groups.archived}
          sessionActiveTenantId={sessionActiveTenantId}
          onMutated={() => setTick((n) => n + 1)}
        />
      ) : groups.archived.length > 0 ? (
        <p className="text-xs text-slate-500">
          {groups.archived.length} archived tenant(s) hidden. Enable the toggle above to restore.
        </p>
      ) : null}
    </div>
  );
}
