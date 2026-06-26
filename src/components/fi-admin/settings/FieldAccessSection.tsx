"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  revokeStaffFieldAccessGrantAction,
  upsertStaffFieldAccessGrantAction,
} from "@/lib/actions/fi-staff-field-access-actions";
import { STAFF_ACCESS_SCOPES, type StaffAccessScope } from "@/src/lib/staffAccess/staffAccessRegistry";
import { STAFF_FIELD_PERMISSION_LEVELS } from "@/src/lib/staffAccess/staffFieldAccessRegistry";

type FieldRow = {
  moduleKey: string;
  fieldKey: string;
  label: string;
  description: string;
  sensitivity: string;
  effectiveLevel: string;
  inheritedLevel: string;
  scope: string;
  source: string;
  clamped: boolean;
  moduleLevel: string;
  activeGrantId: string | null;
  activeGrantLevel: string | null;
  activeGrantScope: string | null;
};

type ModuleRow = { key: string; label: string };
type ClinicRow = { id: string; name: string };

type FieldAuditRow = {
  id: string;
  moduleKey: string;
  fieldKey: string;
  previousPermission: unknown;
  newPermission: unknown;
  reason: string | null;
  createdAt: string;
};

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";
const inputClass =
  "rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";
const btnPrimary =
  "rounded-lg bg-[#22C1FF]/15 px-3 py-1.5 text-sm font-medium text-[#22C1FF] ring-1 ring-[#22C1FF]/30 transition hover:bg-[#22C1FF]/25 disabled:opacity-50";
const btnGhost =
  "rounded-lg px-2.5 py-1 text-xs font-medium text-[#94A3B8] ring-1 ring-white/[0.1] transition hover:text-[#E2E8F0] hover:ring-white/[0.2] disabled:opacity-50";

const LEVEL_TONE: Record<string, string> = {
  hidden: "text-[#64748B]",
  masked: "text-[#A78BFA]",
  summary: "text-[#818CF8]",
  read: "text-[#38BDF8]",
  edit: "text-[#34D399]",
  approve: "text-[#FBBF24]",
  export: "text-[#F472B6]",
};

const SENSITIVITY_TONE: Record<string, string> = {
  standard: "bg-white/[0.06] text-[#94A3B8]",
  sensitive: "bg-amber-500/15 text-amber-300",
  clinical: "bg-sky-500/15 text-sky-300",
  financial: "bg-emerald-500/15 text-emerald-300",
  identity: "bg-rose-500/15 text-rose-300",
  governance: "bg-fuchsia-500/15 text-fuchsia-300",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function summarisePermission(v: unknown): string {
  if (!v || typeof v !== "object") return "none";
  const o = v as Record<string, unknown>;
  const level = o.permission_level ?? "none";
  const scope = o.scope ? `/${o.scope}` : "";
  return `${level}${scope}`;
}

export function FieldAccessSection({
  tenantId,
  canManage,
  staffMemberId,
  staffName,
  modules,
  clinics,
  fieldsByModule,
  moduleLevels,
  audit,
}: {
  tenantId: string;
  canManage: boolean;
  staffMemberId: string;
  staffName: string;
  modules: ModuleRow[];
  clinics: ClinicRow[];
  fieldsByModule: Record<string, FieldRow[]>;
  moduleLevels: Record<string, string>;
  audit: FieldAuditRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const modulesWithFields = useMemo(
    () => modules.filter((m) => (fieldsByModule[m.key]?.length ?? 0) > 0),
    [modules, fieldsByModule]
  );

  function toggle(moduleKey: string) {
    setExpanded((prev) => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  }

  return (
    <div className={sectionClass}>
      <h2 className="text-sm font-semibold text-[#E2E8F0]">Field access</h2>
      <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#94A3B8]">
        A second gate <span className="text-[#CBD5E1]">inside</span> module access. For each module{" "}
        <span className="text-[#CBD5E1]">{staffName}</span> can open, control which fields they can{" "}
        view, edit, approve, or export. Field access can never exceed module access — a grant above
        the module level is clamped automatically.
      </p>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {modulesWithFields.map((m) => {
          const fields = fieldsByModule[m.key] ?? [];
          const moduleLevel = moduleLevels[m.key] ?? "none";
          const moduleBlocked = moduleLevel === "none";
          const isOpen = !!expanded[m.key];
          return (
            <div
              key={m.key}
              className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#081020]/40"
            >
              <button
                type="button"
                onClick={() => toggle(m.key)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[#64748B]">{isOpen ? "▾" : "▸"}</span>
                  <span className="text-sm font-medium text-[#E2E8F0]">{m.label}</span>
                  <span className="text-xs text-[#64748B]">({fields.length} fields)</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-[#64748B]">Module access:</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      moduleBlocked ? "bg-[#475569]/20 text-[#64748B]" : "bg-[#22C1FF]/10 text-[#22C1FF]"
                    }`}
                  >
                    {moduleLevel}
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-white/[0.06] px-3 py-2">
                  {moduleBlocked ? (
                    <p className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      No module access — every field below is hidden regardless of any grant. Raise
                      module access first (Module access matrix above).
                    </p>
                  ) : null}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-[#64748B]">
                          <th className="px-2 py-2">Field</th>
                          <th className="px-2 py-2">Sensitivity</th>
                          <th className="px-2 py-2">Inherited</th>
                          <th className="px-2 py-2">Effective</th>
                          <th className="px-2 py-2">Grant</th>
                          <th className="px-2 py-2">Set field grant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((f) => (
                          <FieldRowEditor
                            key={f.fieldKey}
                            tenantId={tenantId}
                            staffMemberId={staffMemberId}
                            field={f}
                            clinics={clinics}
                            canManage={canManage}
                            pending={pending}
                            onError={setError}
                            onStart={(fn) => startTransition(fn)}
                            onDone={() => router.refresh()}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[#64748B]">
        Levels (weakest → strongest): <code>hidden</code> · <code>masked</code> ·{" "}
        <code>summary</code> · <code>read</code> · <code>edit</code> · <code>approve</code> ·{" "}
        <code className="text-[#F472B6]">export</code>. Export is separate — it gates data leaving
        the platform and is never implied by read/edit/approve.
      </p>

      {/* Field-level audit history */}
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <h3 className="mb-2 text-sm font-semibold text-[#E2E8F0]">Field access audit history</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-[#64748B]">No field permission changes recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-white/[0.06] bg-[#081020]/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#E2E8F0]">
                    {a.moduleKey} / {a.fieldKey}
                  </span>
                  <span className="text-xs text-[#64748B]">{fmtDate(a.createdAt)}</span>
                </div>
                <div className="mt-1 text-xs text-[#94A3B8]">
                  {summarisePermission(a.previousPermission)} → {summarisePermission(a.newPermission)}
                  {a.reason ? <span className="ml-2 italic text-[#64748B]">“{a.reason}”</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldRowEditor({
  tenantId,
  staffMemberId,
  field,
  clinics,
  canManage,
  pending,
  onError,
  onStart,
  onDone,
}: {
  tenantId: string;
  staffMemberId: string;
  field: FieldRow;
  clinics: ClinicRow[];
  canManage: boolean;
  pending: boolean;
  onError: (e: string | null) => void;
  onStart: (fn: () => void) => void;
  onDone: () => void;
}) {
  const [level, setLevel] = useState<string>(field.activeGrantLevel ?? field.effectiveLevel);
  const [scope, setScope] = useState<StaffAccessScope>(
    (field.activeGrantScope as StaffAccessScope) ?? "tenant"
  );
  const [clinicId, setClinicId] = useState<string>("");

  const isCustom = field.source === "grant";

  function save() {
    onError(null);
    onStart(async () => {
      const res = await upsertStaffFieldAccessGrantAction({
        tenantId,
        staffMemberId,
        moduleKey: field.moduleKey,
        fieldKey: field.fieldKey,
        permissionLevel: level,
        scope,
        clinicId: scope === "clinic" && clinicId ? clinicId : null,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  function revoke() {
    if (!field.activeGrantId) return;
    onError(null);
    onStart(async () => {
      const res = await revokeStaffFieldAccessGrantAction({
        tenantId,
        grantId: field.activeGrantId!,
      });
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <tr className="border-t border-white/[0.06] align-top">
      <td className="px-2 py-2">
        <div className="font-medium text-[#E2E8F0]">{field.label}</div>
        <div className="text-xs text-[#64748B]">{field.fieldKey}</div>
      </td>
      <td className="px-2 py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            SENSITIVITY_TONE[field.sensitivity] ?? "bg-white/[0.06] text-[#94A3B8]"
          }`}
        >
          {field.sensitivity}
        </span>
      </td>
      <td className={`px-2 py-2 ${LEVEL_TONE[field.inheritedLevel] ?? ""}`}>
        {field.inheritedLevel}
      </td>
      <td className={`px-2 py-2 font-medium ${LEVEL_TONE[field.effectiveLevel] ?? ""}`}>
        {field.effectiveLevel}
        {field.clamped ? (
          <span
            className="ml-1.5 cursor-help rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-300"
            title={`Requested level exceeds module access (${field.moduleLevel}) — clamped down to ${field.effectiveLevel}.`}
          >
            clamped
          </span>
        ) : null}
      </td>
      <td className="px-2 py-2 text-xs">
        {isCustom ? (
          <span className="rounded bg-[#F472B6]/15 px-1.5 py-0.5 text-[#F472B6]">Custom grant</span>
        ) : (
          <span className="rounded bg-[#38BDF8]/15 px-1.5 py-0.5 text-[#38BDF8]">Inherited</span>
        )}
      </td>
      <td className="px-2 py-2">
        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className={inputClass}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {STAFF_FIELD_PERMISSION_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
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
                className={inputClass}
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
            {field.activeGrantId ? (
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
