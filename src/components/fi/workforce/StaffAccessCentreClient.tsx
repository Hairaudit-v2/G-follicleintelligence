"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  copyStaffLoginInviteLinkAction,
  resendStaffLoginInviteAction,
  revokeStaffLoginAccessAction,
  sendStaffLoginInviteAction,
  suspendStaffLoginAccessAction,
} from "@/src/lib/actions/workforce-staff-access-actions";
import type { StaffAccessCentreRow } from "@/src/lib/workforce/staffAccessCentre.server";

export type StaffAccessFilter = "all" | "needs_login" | "login_active" | "suspended" | "archived";

const FILTERS: { id: StaffAccessFilter; label: string }[] = [
  { id: "all", label: "All staff" },
  { id: "needs_login", label: "Needs login" },
  { id: "login_active", label: "Login active" },
  { id: "suspended", label: "Suspended / revoked" },
  { id: "archived", label: "Archived" },
];

function matchesFilter(row: StaffAccessCentreRow, filter: StaffAccessFilter): boolean {
  if (filter === "archived") return Boolean(row.archivedAt);
  if (row.archivedAt) return false;
  if (filter === "all") return true;
  if (filter === "needs_login") {
    return row.authLoginStatus === "no_login" || row.authLoginStatus === "invite_pending";
  }
  if (filter === "login_active") return row.authLoginStatus === "login_active";
  if (filter === "suspended") {
    return (
      row.authLoginStatus === "suspended" ||
      row.authLoginStatus === "revoked" ||
      row.systemAccessRevoked
    );
  }
  return true;
}

function statusBadgeClass(kind: "auth" | "invite" | "pin", value: string): string {
  const v = value.toLowerCase();
  if (kind === "auth") {
    if (v.includes("active")) return "text-emerald-400";
    if (v.includes("pending") || v.includes("no login")) return "text-amber-300";
    if (v.includes("suspended") || v.includes("revoked")) return "text-rose-400";
  }
  if (kind === "invite") {
    if (v.includes("accepted")) return "text-emerald-400";
    if (v.includes("pending")) return "text-amber-300";
    if (v.includes("expired") || v.includes("revoked")) return "text-rose-400";
  }
  if (kind === "pin") {
    if (v.includes("active")) return "text-emerald-400";
    if (v.includes("locked")) return "text-rose-400";
    if (v.includes("disabled")) return "text-slate-500";
  }
  return "text-slate-400";
}

export function StaffAccessCentreClient({
  tenantId,
  rows,
  canManage,
}: {
  tenantId: string;
  rows: StaffAccessCentreRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StaffAccessFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (!showArchived && row.archivedAt && filter !== "archived") return false;
      return matchesFilter(row, filter);
    });
  }, [rows, filter, showArchived]);

  const needsLoginCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          !r.archivedAt &&
          (r.authLoginStatus === "no_login" || r.authLoginStatus === "invite_pending")
      ).length,
    [rows]
  );

  const runAction = useCallback(
    (
      staffMemberId: string,
      action:
        | "send"
        | "resend"
        | "copy"
        | "revoke"
        | "suspend"
    ) => {
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const body = { staffMemberId };
        let result:
          | { ok: true; inviteUrl?: string; emailSent?: boolean }
          | { ok: false; error: string };

        if (action === "send") result = await sendStaffLoginInviteAction(tenantId, body);
        else if (action === "resend") result = await resendStaffLoginInviteAction(tenantId, body);
        else if (action === "copy") result = await copyStaffLoginInviteLinkAction(tenantId, body);
        else if (action === "revoke") result = await revokeStaffLoginAccessAction(tenantId, body);
        else result = await suspendStaffLoginAccessAction(tenantId, body);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        if (action === "copy" && result.inviteUrl) {
          try {
            await navigator.clipboard.writeText(result.inviteUrl);
            setCopiedStaffId(staffMemberId);
            setMessage("Invite link copied to clipboard.");
          } catch {
            setMessage(result.inviteUrl);
          }
        } else if (action === "send" || action === "resend") {
          setMessage(
            result.emailSent
              ? "Login invite sent by email."
              : "Login invite created — copy the link if email delivery is not configured."
          );
        } else if (action === "revoke") {
          setMessage("Staff login access revoked.");
        } else if (action === "suspend") {
          setMessage("Staff login access suspended.");
        }

        router.refresh();
      });
    },
    [router, tenantId]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            WorkforceOS
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Staff Access Centre</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Provision login access for existing active staff in{" "}
            <span className="text-[#CBD5E1]">fi_staff_members</span> — no new staff record
            required. Send Supabase auth invites, review PIN status, and manage access without
            using the onboarding flow.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 px-4 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-[#64748B]">Needs login</p>
          <p className="mt-1 text-2xl font-semibold text-[#F8FAFC]">{needsLoginCount}</p>
        </div>
      </header>

      {!canManage ? (
        <InfoNotice variant="warning">
          You can view staff access status but cannot send invites or change access.
        </InfoNotice>
      ) : null}

      {message ? <InfoNotice variant="success">{message}</InfoNotice> : null}
      {error ? <InfoNotice variant="danger">{error}</InfoNotice> : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? "rounded-full bg-[#22C1FF]/20 px-3 py-1 text-xs font-semibold text-[#22C1FF]"
                : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
            }
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[#94A3B8]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived staff
        </label>
      </div>

      <DashboardCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Employment</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">PIN</th>
              <th className="px-4 py-3">Permission template</th>
              <th className="px-4 py-3">Invite</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 8 : 7}
                  className="px-4 py-8 text-center text-[#94A3B8]"
                >
                  No staff match the current filters.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.staffMemberId} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F8FAFC]">{row.fullName}</p>
                    <p className="text-xs text-[#64748B]">{row.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {row.roleCode?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-[#CBD5E1]">
                    {row.employmentStatus.replace(/_/g, " ")}
                  </td>
                  <td className={`px-4 py-3 ${statusBadgeClass("auth", row.authLoginLabel)}`}>
                    {row.authLoginLabel}
                  </td>
                  <td className={`px-4 py-3 ${statusBadgeClass("pin", row.pinStatus)}`}>
                    {row.pinStatus}
                  </td>
                  <td className="px-4 py-3 text-[#CBD5E1]">{row.permissionTemplate}</td>
                  <td className={`px-4 py-3 ${statusBadgeClass("invite", row.inviteLabel)}`}>
                    {row.inviteLabel}
                    {row.invitedAt ? (
                      <p className="text-xs text-[#64748B]">
                        {new Date(row.invitedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.canSendInvite ? (
                          <ActionButton
                            label="Send invite"
                            disabled={pending}
                            onClick={() => runAction(row.staffMemberId, "send")}
                          />
                        ) : null}
                        {row.canResendInvite ? (
                          <ActionButton
                            label="Resend"
                            disabled={pending}
                            onClick={() => runAction(row.staffMemberId, "resend")}
                          />
                        ) : null}
                        {row.canCopyInviteLink ? (
                          <ActionButton
                            label={copiedStaffId === row.staffMemberId ? "Copied" : "Copy link"}
                            disabled={pending}
                            onClick={() => runAction(row.staffMemberId, "copy")}
                          />
                        ) : null}
                        {row.canSuspendAccess ? (
                          <ActionButton
                            label="Suspend"
                            tone="warn"
                            disabled={pending}
                            onClick={() => runAction(row.staffMemberId, "suspend")}
                          />
                        ) : null}
                        {row.canRevokeAccess ? (
                          <ActionButton
                            label="Revoke"
                            tone="danger"
                            disabled={pending}
                            onClick={() => runAction(row.staffMemberId, "revoke")}
                          />
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DashboardCard>

      <InfoNotice variant="info">
        New hires still use the HR OS{" "}
        <a
          href={`/fi-admin/${tenantId}/hr-os/onboarding`}
          className="font-medium text-[#22C1FF] underline"
        >
          Onboarding Centre
        </a>{" "}
        to create staff records. This centre is for existing active staff who need login access
        only.
      </InfoNotice>
    </div>
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  tone = "default",
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  tone?: "default" | "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
      : tone === "warn"
        ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
        : "border-white/10 text-[#CBD5E1] hover:bg-white/5";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
