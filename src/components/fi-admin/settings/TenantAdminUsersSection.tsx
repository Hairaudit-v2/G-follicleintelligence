"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ChangeEvent } from "react";

import {
  inviteTenantAdminUserAction,
  reactivateTenantAdminUserAction,
  revokeTenantAdminUserAccessAction,
  suspendTenantAdminUserAction,
  updateTenantAdminUserRoleAction,
} from "@/lib/actions/fi-tenant-admin-actions";
import type { FiTenantAdminUserRow } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import {
  FI_TENANT_ADMIN_ROLES,
  FI_TENANT_ADMIN_ROLE_CAPABILITIES,
} from "@/src/lib/tenantAdmin/tenantAdminRoles";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

const ROLE_LABEL: Record<string, string> = {
  clinic_admin: "Clinic admin",
  finance_admin: "Finance admin",
  operations_admin: "Operations admin",
  dashboard_viewer: "Dashboard viewer",
  data_safety_admin: "Data safety admin",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function TenantAdminUsersSection({
  tenantId,
  rows,
  lastLoginByAuthUserId,
}: {
  tenantId: string;
  rows: FiTenantAdminUserRow[];
  lastLoginByAuthUserId: Record<string, string | null>;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string>(FI_TENANT_ADMIN_ROLES[0]);
  const [accessNotes, setAccessNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [rows]
  );

  function submitInvite() {
    setError(null);
    startTransition(async () => {
      const res = await inviteTenantAdminUserAction({
        tenantId,
        email: email.trim(),
        displayName: displayName.trim() || null,
        role,
        accessNotes: accessNotes.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      setShowInvite(false);
      setEmail("");
      setDisplayName("");
      setAccessNotes("");
      setRole(FI_TENANT_ADMIN_ROLES[0]);
    });
  }

  return (
    <div className="space-y-4">
      <details className={sectionClass}>
        <summary className="cursor-pointer text-sm font-medium text-[#CBD5E1]">
          Role capabilities
        </summary>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs text-[#94A3B8]">
          {FI_TENANT_ADMIN_ROLES.map((r) => (
            <li key={r}>
              <span className="font-medium text-slate-300">{ROLE_LABEL[r] ?? r}:</span>{" "}
              {FI_TENANT_ADMIN_ROLE_CAPABILITIES[r]}
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          onClick={() => setShowInvite((v) => !v)}
        >
          {showInvite ? "Close invite form" : "Invite user"}
        </button>
      </div>

      {showInvite ? (
        <div className={sectionClass}>
          <h2 className="mb-2 text-base font-semibold text-[#F8FAFC]">Invite user</h2>
          <p className="mb-3 text-xs text-[#94A3B8]">
            Grants platform access via this tenant&apos;s existing Supabase login — no separate auth
            system. Creates or reuses a <span className="text-[#CBD5E1]">fi_users</span> row and a{" "}
            <span className="text-[#CBD5E1]">fi_tenant_admin_users</span> role; does not create{" "}
            <span className="text-[#CBD5E1]">fi_staff</span>. Sends an auth invite when the account
            is not linked yet.
          </p>
          <div className="grid max-w-lg gap-3">
            <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
              Email
              <input
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
              Display name (optional)
              <input
                className={inputClass}
                value={displayName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
              Role
              <select
                className={inputClass}
                value={role}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
              >
                {FI_TENANT_ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r] ?? r}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#CBD5E1]">
              Access notes (optional)
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={accessNotes}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAccessNotes(e.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !email.trim()}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void submitInvite()}
              >
                {pending ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#060d18]/60">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last login</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No admin users yet. Invite a trusted user for CFO, finance, operations,
                  compliance, or read-only analytics access — without adding them as clinical staff.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <TenantAdminUserRow
                  key={r.id}
                  tenantId={tenantId}
                  row={r}
                  lastLogin={
                    r.fiUserAuthUserId ? (lastLoginByAuthUserId[r.fiUserAuthUserId] ?? null) : null
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TenantAdminUserRow({
  tenantId,
  row,
  lastLogin,
}: {
  tenantId: string;
  row: FiTenantAdminUserRow;
  lastLogin: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [localRole, setLocalRole] = useState(row.adminRole);
  const display = row.displayName?.trim() || row.fiUserEmail || "—";

  return (
    <tr className="border-b border-white/[0.05] last:border-0">
      <td className="px-3 py-2 font-medium text-slate-100">{display}</td>
      <td className="px-3 py-2 text-slate-300">{row.fiUserEmail ?? "—"}</td>
      <td className="px-3 py-2">
        <select
          className={`${inputClass} h-8 max-w-[200px] text-xs`}
          value={localRole}
          disabled={pending}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            const v = e.target.value;
            setLocalRole(v as (typeof FI_TENANT_ADMIN_ROLES)[number]);
            startTransition(async () => {
              await updateTenantAdminUserRoleAction({ tenantId, adminUserId: row.id, role: v });
              router.refresh();
            });
          }}
        >
          {FI_TENANT_ADMIN_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role] ?? role}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 capitalize text-slate-300">{row.status}</td>
      <td className="px-3 py-2 text-slate-400">{fmtDate(lastLogin)}</td>
      <td className="px-3 py-2 text-slate-400">{fmtDate(row.createdAt)}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {row.status === "suspended" ? (
            <button
              type="button"
              className="rounded border border-white/15 px-2 py-0.5 text-xs text-slate-200 hover:bg-white/5"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await reactivateTenantAdminUserAction({ tenantId, adminUserId: row.id });
                  router.refresh();
                })
              }
            >
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              className="rounded border border-amber-700/50 px-2 py-0.5 text-xs text-amber-100 hover:bg-amber-900/20"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await suspendTenantAdminUserAction({ tenantId, adminUserId: row.id });
                  router.refresh();
                })
              }
            >
              Suspend
            </button>
          )}
          <button
            type="button"
            className="rounded border border-red-800/50 px-2 py-0.5 text-xs text-red-200 hover:bg-red-950/30"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "Revoke admin access for this user? Their FI login row stays; only this tenant admin role is removed. Staff records are unchanged."
                )
              ) {
                return;
              }
              startTransition(async () => {
                const res = await revokeTenantAdminUserAccessAction({
                  tenantId,
                  adminUserId: row.id,
                });
                if (!res.ok) {
                  window.alert(res.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Revoke access
          </button>
        </div>
      </td>
    </tr>
  );
}
