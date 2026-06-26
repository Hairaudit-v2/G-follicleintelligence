"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  revokeStaffAccessGrantAction,
  upsertStaffAccessGrantAction,
} from "@/lib/actions/fi-staff-access-actions";
import {
  STAFF_ACCESS_LEVELS,
  STAFF_ACCESS_SCOPES,
  STAFF_ROLE_LABELS,
  type StaffAccessLevel,
  type StaffAccessScope,
  type StaffRoleKey,
} from "@/src/lib/staffAccess/staffAccessRegistry";

type StaffRow = {
  id: string;
  fullName: string;
  staffRole: string;
  roleKey: StaffRoleKey | null;
  isActive: boolean;
};

type ModuleRow = { key: string; label: string; description: string; category: string };
type ClinicRow = { id: string; name: string };
type EffectiveRecord = Record<string, { level: string; scope: string; source: string }>;
type RoleRecord = Record<string, { level: string; scope: string }>;

type GrantRow = {
  id: string;
  clinicId: string | null;
  moduleKey: string;
  tabKey: string | null;
  accessLevel: StaffAccessLevel;
  scope: StaffAccessScope;
  grantedAt: string;
  revokedAt: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  moduleKey: string | null;
  tabKey: string | null;
  previousAccess: unknown;
  newAccess: unknown;
  reason: string | null;
  createdAt: string;
};

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";
const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";
const btnPrimary =
  "rounded-lg bg-[#22C1FF]/15 px-3 py-1.5 text-sm font-medium text-[#22C1FF] ring-1 ring-[#22C1FF]/30 transition hover:bg-[#22C1FF]/25 disabled:opacity-50";
const btnGhost =
  "rounded-lg px-2.5 py-1 text-xs font-medium text-[#94A3B8] ring-1 ring-white/[0.1] transition hover:text-[#E2E8F0] hover:ring-white/[0.2] disabled:opacity-50";

function fmtDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const LEVEL_TONE: Record<string, string> = {
  none: "text-[#64748B]",
  read: "text-[#38BDF8]",
  edit: "text-[#34D399]",
  approve: "text-[#FBBF24]",
  admin: "text-[#F472B6]",
};

export function StaffAccessSection({
  tenantId,
  canManage,
  staff,
  selectedStaffId,
  clinics,
  modules,
  effective,
  roleDefaults,
  grants,
  audit,
}: {
  tenantId: string;
  canManage: boolean;
  staff: StaffRow[];
  selectedStaffId: string | null;
  clinics: ClinicRow[];
  modules: ModuleRow[];
  effective: EffectiveRecord | null;
  roleDefaults: RoleRecord | null;
  grants: GrantRow[];
  audit: AuditRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => staff.find((s) => s.id === selectedStaffId) ?? null,
    [staff, selectedStaffId]
  );

  function selectStaff(id: string) {
    const url = id
      ? `/fi-admin/${tenantId}/settings/staff-access?staffId=${id}`
      : `/fi-admin/${tenantId}/settings/staff-access`;
    router.push(url);
  }

  return (
    <div className="space-y-4">
      {/* Staff member selector */}
      <div className={sectionClass}>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#64748B]">
          Staff member
        </label>
        <select
          className={inputClass}
          value={selectedStaffId ?? ""}
          onChange={(e) => selectStaff(e.target.value)}
        >
          <option value="">Select a staff member…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} — {s.roleKey ? STAFF_ROLE_LABELS[s.roleKey] : s.staffRole || "Unmapped"}
              {s.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </select>
        {selected ? (
          <p className="mt-2 text-sm text-[#94A3B8]">
            Role template:{" "}
            <span className="font-medium text-[#E2E8F0]">
              {selected.roleKey
                ? STAFF_ROLE_LABELS[selected.roleKey]
                : selected.staffRole || "Unmapped role"}
            </span>
            {selected.roleKey ? null : (
              <span className="ml-2 text-xs text-[#FBBF24]">
                No standard role mapping — only explicit grants apply.
              </span>
            )}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {/* Module access matrix */}
      {selected && effective && roleDefaults ? (
        <div className={sectionClass}>
          <h2 className="mb-3 text-sm font-semibold text-[#E2E8F0]">Module access matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#64748B]">
                  <th className="px-2 py-2">Module</th>
                  <th className="px-2 py-2">Role default</th>
                  <th className="px-2 py-2">Effective</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Set grant</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const eff = effective[m.key] ?? {
                    level: "none",
                    scope: "tenant",
                    source: "role",
                  };
                  const role = roleDefaults[m.key] ?? { level: "none", scope: "tenant" };
                  const activeGrant = grants.find(
                    (g) => g.moduleKey === m.key && !g.tabKey && !g.revokedAt
                  );
                  return (
                    <ModuleRowEditor
                      key={m.key}
                      tenantId={tenantId}
                      staffMemberId={selected.id}
                      roleKey={selected.roleKey}
                      module={m}
                      effective={eff}
                      roleDefault={role}
                      clinics={clinics}
                      activeGrant={activeGrant ?? null}
                      canManage={canManage}
                      pending={pending}
                      onError={setError}
                      onStart={(fn) => startTransition(fn)}
                      onDone={() => router.refresh()}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[#64748B]">
            <span className="text-[#38BDF8]">Inherited from role</span> = comes from the role
            template. <span className="text-[#F472B6]">Custom grant</span> = an explicit override on
            this person. Setting a level of <code>none</code> suppresses a module the role would
            otherwise allow.
          </p>
        </div>
      ) : null}

      {/* Audit history */}
      {selected ? (
        <div className={sectionClass}>
          <h2 className="mb-3 text-sm font-semibold text-[#E2E8F0]">Audit history</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-[#64748B]">No access changes recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-white/[0.06] bg-[#081020]/60 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#E2E8F0]">
                      {a.action.replace(/_/g, " ")}
                      {a.moduleKey ? ` · ${a.moduleKey}${a.tabKey ? ` / ${a.tabKey}` : ""}` : ""}
                    </span>
                    <span className="text-xs text-[#64748B]">{fmtDate(a.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#94A3B8]">
                    {summariseAccess(a.previousAccess)} → {summariseAccess(a.newAccess)}
                    {a.reason ? (
                      <span className="ml-2 italic text-[#64748B]">“{a.reason}”</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function summariseAccess(v: unknown): string {
  if (!v || typeof v !== "object") return "none";
  const o = v as Record<string, unknown>;
  const level = o.access_level ?? "none";
  const scope = o.scope ? `/${o.scope}` : "";
  return `${level}${scope}`;
}

function ModuleRowEditor({
  tenantId,
  staffMemberId,
  roleKey,
  module,
  effective,
  roleDefault,
  clinics,
  activeGrant,
  canManage,
  pending,
  onError,
  onStart,
  onDone,
}: {
  tenantId: string;
  staffMemberId: string;
  roleKey: StaffRoleKey | null;
  module: ModuleRow;
  effective: { level: string; scope: string; source: string };
  roleDefault: { level: string; scope: string };
  clinics: ClinicRow[];
  activeGrant: GrantRow | null;
  canManage: boolean;
  pending: boolean;
  onError: (e: string | null) => void;
  onStart: (fn: () => void) => void;
  onDone: () => void;
}) {
  const [level, setLevel] = useState<StaffAccessLevel>(
    (activeGrant?.accessLevel as StaffAccessLevel) ?? "read"
  );
  const [scope, setScope] = useState<StaffAccessScope>(
    (activeGrant?.scope as StaffAccessScope) ?? "tenant"
  );
  const [clinicId, setClinicId] = useState<string>(activeGrant?.clinicId ?? "");

  const isCustom = effective.source === "grant";

  function save() {
    onError(null);
    onStart(async () => {
      const res = await upsertStaffAccessGrantAction({
        tenantId,
        staffMemberId,
        moduleKey: module.key,
        accessLevel: level,
        scope,
        clinicId: scope === "clinic" && clinicId ? clinicId : null,
        roleKey: roleKey ?? null,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  function revoke() {
    if (!activeGrant) return;
    onError(null);
    onStart(async () => {
      const res = await revokeStaffAccessGrantAction({ tenantId, grantId: activeGrant.id });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <tr className="border-t border-white/[0.06]">
      <td className="px-2 py-2">
        <div className="font-medium text-[#E2E8F0]">{module.label}</div>
        <div className="text-xs text-[#64748B]">{module.key}</div>
      </td>
      <td className={`px-2 py-2 ${LEVEL_TONE[roleDefault.level] ?? ""}`}>
        {roleDefault.level}
        <span className="text-[#475569]">
          {roleDefault.level !== "none" ? `/${roleDefault.scope}` : ""}
        </span>
      </td>
      <td className={`px-2 py-2 font-medium ${LEVEL_TONE[effective.level] ?? ""}`}>
        {effective.level}
        <span className="text-[#475569]">
          {effective.level !== "none" ? `/${effective.scope}` : ""}
        </span>
      </td>
      <td className="px-2 py-2 text-xs">
        {isCustom ? (
          <span className="rounded bg-[#F472B6]/15 px-1.5 py-0.5 text-[#F472B6]">Custom grant</span>
        ) : effective.level !== "none" ? (
          <span className="rounded bg-[#38BDF8]/15 px-1.5 py-0.5 text-[#38BDF8]">Inherited</span>
        ) : (
          <span className="text-[#475569]">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className={`${inputClass} w-auto`}
              value={level}
              onChange={(e) => setLevel(e.target.value as StaffAccessLevel)}
            >
              {STAFF_ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={`${inputClass} w-auto`}
              value={scope}
              onChange={(e) => setScope(e.target.value as StaffAccessScope)}
            >
              {STAFF_ACCESS_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {scope === "clinic" ? (
              <select
                className={`${inputClass} w-auto`}
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
              >
                <option value="">All clinics</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
              Save
            </button>
            {activeGrant ? (
              <button type="button" className={btnGhost} disabled={pending} onClick={revoke}>
                Revoke
              </button>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-[#64748B]">Read-only</span>
        )}
      </td>
    </tr>
  );
}
