"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FiOsPendingActionButton } from "@/src/components/fi-os/FiOsPendingActionButton";
import { StaffHrTaskMapEntryBanner } from "@/src/components/fi/workforce/StaffHrTaskMapEntryBanner";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  copyOnboardingInviteLinkAction,
  createOnboardingStaffAction,
  markOnboardingTrainingCompleteAction,
  resendOnboardingInviteAction,
  sendOnboardingInviteAction,
} from "@/src/lib/actions/workforce-onboarding-actions";
import {
  ONBOARDING_EMPLOYMENT_TYPE_LABELS,
  ONBOARDING_EMPLOYMENT_TYPES,
  type OnboardingClinicOption,
  type OnboardingEmploymentType,
  type OnboardingStaffRow,
} from "@/src/lib/workforce/onboarding/onboardingTypes";

function inviteStatusClass(status: string): string {
  if (status === "accepted") return "text-emerald-400";
  if (status === "expired" || status === "revoked") return "text-rose-400";
  if (status === "pending") return "text-amber-300";
  return "text-slate-500";
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={
          done
            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
            : "inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-slate-500"
        }
        aria-hidden
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-slate-200" : "text-slate-400"}>{label}</span>
    </li>
  );
}

export function OnboardingCentreClient({
  tenantId,
  staff,
  clinics,
  roleOptions,
  canManage,
}: {
  tenantId: string;
  staff: OnboardingStaffRow[];
  clinics: OnboardingClinicOption[];
  roleOptions: { value: string; label: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    roleCode: string;
    clinicId: string;
    employmentType: OnboardingEmploymentType;
  }>({
    fullName: "",
    email: "",
    roleCode: roleOptions[0]?.value ?? "consultant",
    clinicId: "",
    employmentType: ONBOARDING_EMPLOYMENT_TYPES[0],
  });

  const onCreate = useCallback(() => {
    setError(null);
    setMessage(null);
    setInviteUrl(null);
    setCreatePending(true);
    startTransition(async () => {
      try {
        const result = await createOnboardingStaffAction(tenantId, {
          ...form,
          clinicId: form.clinicId.trim() || null,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage("Staff member created. Send an onboarding invite when ready.");
        setForm((f) => ({ ...f, fullName: "", email: "" }));
        router.refresh();
      } finally {
        setCreatePending(false);
      }
    });
  }, [form, router, tenantId]);

  const runInviteAction = useCallback(
    (staffMemberId: string, action: "send" | "resend" | "copy") => {
      setError(null);
      setMessage(null);
      setInviteUrl(null);
      const actionKey = `${staffMemberId}:${action}`;
      setPendingActionKey(actionKey);
      startTransition(async () => {
        try {
          let result:
            | { ok: true; inviteUrl?: string; emailSent?: boolean; wasExpired?: boolean }
            | { ok: false; error: string };

          if (action === "send") result = await sendOnboardingInviteAction(tenantId, staffMemberId);
          else if (action === "resend")
            result = await resendOnboardingInviteAction(tenantId, staffMemberId);
          else result = await copyOnboardingInviteLinkAction(tenantId, staffMemberId);

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
              setInviteUrl(result.inviteUrl);
              setMessage(result.inviteUrl);
            }
          } else if (action === "send") {
            setInviteUrl(result.inviteUrl ?? null);
            setMessage(
              result.emailSent
                ? "Invitation email sent."
                : "Email delivery is not configured. Copy and send the invite link manually."
            );
          } else if (action === "resend") {
            setInviteUrl(result.inviteUrl ?? null);
            if (result.wasExpired) {
              setMessage(
                result.emailSent
                  ? "This invite has expired. A new secure link has been generated and emailed."
                  : "This invite has expired. A new secure link has been generated — copy and send it manually."
              );
            } else {
              setMessage(
                result.emailSent
                  ? "Invite resent."
                  : "Invite resent. Email delivery is not configured. Copy and send the invite link manually."
              );
            }
          }

          router.refresh();
        } finally {
          setPendingActionKey(null);
        }
      });
    },
    [router, tenantId]
  );

  const onMarkTrainingComplete = useCallback(
    (staffMemberId: string) => {
      setError(null);
      const actionKey = `${staffMemberId}:training`;
      setPendingActionKey(actionKey);
      startTransition(async () => {
        try {
          const result = await markOnboardingTrainingCompleteAction(tenantId, staffMemberId);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setMessage("Training marked complete.");
          router.refresh();
        } finally {
          setPendingActionKey(null);
        }
      });
    },
    [router, tenantId]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Onboarding</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Create staff, send onboarding invites, resend when needed, and track checklist progress
          through PIN setup and permissions.
        </p>
      </header>

      <StaffHrTaskMapEntryBanner tenantId={tenantId} surface="onboarding" className="mt-6" />

      {!canManage ? (
        <InfoNotice variant="warning" className="mt-6">
          You can view onboarding status but cannot send or resend invites.
        </InfoNotice>
      ) : null}

      {error ? (
        <InfoNotice variant="warning" title="Action failed" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" title="Success" className="mt-6">
          <p className="text-sm">{message}</p>
          {inviteUrl ? (
            <p className="mt-2 break-all font-mono text-xs text-slate-300">{inviteUrl}</p>
          ) : null}
        </InfoNotice>
      ) : null}

      {canManage ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-100">Create staff member</h2>
          <DashboardCard className="mt-3 p-6" elevated>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-400">Name</span>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
                  placeholder="Full name"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
                  placeholder="name@clinic.com"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Role</span>
                <select
                  value={form.roleCode}
                  onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Clinic</span>
                <select
                  value={form.clinicId}
                  onChange={(e) => setForm((f) => ({ ...f, clinicId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100"
                >
                  <option value="">— Select clinic —</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-400">Employment type</span>
                <select
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      employmentType: e.target.value as OnboardingEmploymentType,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-100 sm:max-w-xs"
                >
                  {ONBOARDING_EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ONBOARDING_EMPLOYMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              className="mt-4"
              disabled={createPending || pendingActionKey !== null}
              onClick={onCreate}
            >
              {createPending ? "Creating…" : "Create staff member"}
            </Button>
          </DashboardCard>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-100">Onboarding queue</h2>
        <DashboardCard className="mt-3 overflow-x-auto p-0" elevated>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.08] bg-[#0c1426]/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Clinic</th>
                <th className="px-4 py-3 font-medium">Invite</th>
                <th className="px-4 py-3 font-medium">Checklist</th>
                {canManage ? <th className="px-4 py-3 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                    No staff pending onboarding.
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-slate-100">
                      <Link
                        href={`/fi-admin/${tenantId}/workforce-os/staff/${row.id}`}
                        className="font-medium text-[#22C1FF] hover:underline"
                        data-testid="onboarding-profile-link"
                      >
                        {row.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{row.roleCode ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{row.clinicName ?? "—"}</td>
                    <td className={`px-4 py-3 ${inviteStatusClass(row.inviteStatus)}`}>
                      {row.inviteLabel}
                      {row.invitation?.sentAt || row.invitation?.invitedAt ? (
                        <p className="text-xs text-slate-500">
                          Sent{" "}
                          {new Date(
                            row.invitation.sentAt ?? row.invitation.invitedAt
                          ).toLocaleString()}
                        </p>
                      ) : null}
                      {row.invitation?.expiresAt ? (
                        <p className="text-xs text-slate-500">
                          Expires {new Date(row.invitation.expiresAt).toLocaleDateString()}
                        </p>
                      ) : null}
                      {row.invitation && row.invitation.resendCount > 0 ? (
                        <p className="text-xs text-slate-500">
                          Resent {row.invitation.resendCount}×
                        </p>
                      ) : null}
                      {row.systemAccessRevoked ? (
                        <p className="text-xs text-rose-400">Access suspended</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        <ChecklistItem
                          done={row.checklist.accountCreated}
                          label="Account created"
                        />
                        <ChecklistItem done={row.checklist.pinChosen} label="PIN chosen" />
                        <ChecklistItem
                          done={row.checklist.permissionsAssigned}
                          label="Permissions assigned"
                        />
                        <ChecklistItem
                          done={!row.checklist.trainingPending}
                          label={
                            row.checklist.trainingPending ? "Training pending" : "Training complete"
                          }
                        />
                      </ul>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.canSendInvite ? (
                            <FiOsPendingActionButton
                              label="Send invite"
                              actionKey={`${row.id}:send`}
                              activeActionKey={pendingActionKey}
                              anyPending={pendingActionKey !== null}
                              onClick={() => runInviteAction(row.id, "send")}
                            />
                          ) : null}
                          {row.canResendInvite ? (
                            <FiOsPendingActionButton
                              label="Resend invite"
                              actionKey={`${row.id}:resend`}
                              activeActionKey={pendingActionKey}
                              anyPending={pendingActionKey !== null}
                              onClick={() => runInviteAction(row.id, "resend")}
                            />
                          ) : null}
                          {row.canCopyInviteLink ? (
                            <FiOsPendingActionButton
                              label={copiedStaffId === row.id ? "Copied" : "Copy link"}
                              actionKey={`${row.id}:copy`}
                              activeActionKey={pendingActionKey}
                              anyPending={pendingActionKey !== null}
                              onClick={() => runInviteAction(row.id, "copy")}
                            />
                          ) : null}
                          {row.checklist.trainingPending ? (
                            <FiOsPendingActionButton
                              label="Mark training done"
                              actionKey={`${row.id}:training`}
                              activeActionKey={pendingActionKey}
                              anyPending={pendingActionKey !== null}
                              pendingLabel="Saving…"
                              onClick={() => onMarkTrainingComplete(row.id)}
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
      </section>
    </div>
  );
}
