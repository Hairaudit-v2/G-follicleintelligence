"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  createOnboardingStaffAction,
  markOnboardingTrainingCompleteAction,
  sendOnboardingInviteAction,
} from "@/src/lib/actions/workforce-onboarding-actions";
import {
  ONBOARDING_EMPLOYMENT_TYPE_LABELS,
  ONBOARDING_EMPLOYMENT_TYPES,
  type OnboardingClinicOption,
  type OnboardingEmploymentType,
  type OnboardingStaffRow,
} from "@/src/lib/workforce/onboarding/onboardingTypes";

function invitationStatusLabel(status: string): string {
  if (status === "accepted") return "Accepted";
  if (status === "expired") return "Expired";
  return "Pending";
}

function invitationStatusClass(status: string): string {
  if (status === "accepted") return "text-emerald-400";
  if (status === "expired") return "text-rose-400";
  return "text-amber-300";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

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
    startTransition(async () => {
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
    });
  }, [form, router, tenantId]);

  const onSendInvite = useCallback(
    (staffMemberId: string) => {
      setError(null);
      setMessage(null);
      setInviteUrl(null);
      startTransition(async () => {
        const result = await sendOnboardingInviteAction(tenantId, staffMemberId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setInviteUrl(result.inviteUrl);
        setMessage(
          result.emailSent
            ? "Invitation email sent."
            : "Invitation created. Copy the link below — email delivery is not configured."
        );
        router.refresh();
      });
    },
    [router, tenantId]
  );

  const onMarkTrainingComplete = useCallback(
    (staffMemberId: string) => {
      setError(null);
      startTransition(async () => {
        const result = await markOnboardingTrainingCompleteAction(tenantId, staffMemberId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage("Training marked complete.");
        router.refresh();
      });
    },
    [router, tenantId]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Onboarding Centre
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Create staff, send onboarding invites, and track checklist progress through PIN setup
          and permissions.
        </p>
      </header>

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
            <Button className="mt-4" disabled={pending} onClick={onCreate}>
              {pending ? "Creating…" : "Create staff member"}
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
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No staff pending onboarding.
                  </td>
                </tr>
              ) : (
                staff.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-slate-100">{row.fullName}</td>
                    <td className="px-4 py-3 text-slate-300">{row.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{row.roleCode ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{row.clinicName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.invitation ? (
                        <span className={invitationStatusClass(row.invitation.status)}>
                          {invitationStatusLabel(row.invitation.status)}
                        </span>
                      ) : (
                        <span className="text-slate-500">Not sent</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        <ChecklistItem done={row.checklist.accountCreated} label="Account created" />
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
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || !row.email}
                            onClick={() => onSendInvite(row.id)}
                          >
                            Send invite
                          </Button>
                          {row.checklist.trainingPending ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => onMarkTrainingComplete(row.id)}
                            >
                              Mark training done
                            </Button>
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
