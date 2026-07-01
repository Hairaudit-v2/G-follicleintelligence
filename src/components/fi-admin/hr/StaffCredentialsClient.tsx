"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import { createStaffCredentialAction } from "@/src/lib/actions/workforce-phase-1c-sprint-3-actions";
import type { CredentialsPageStaffRow } from "@/src/lib/workforce/credentialsPage.server";
import { STAFF_CREDENTIAL_TYPES } from "@/src/lib/workforce/workforceClinicalTypes";

export function StaffCredentialsClient({
  tenantId,
  staffRows,
  canManage,
}: {
  tenantId: string;
  staffRows: CredentialsPageStaffRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState(staffRows[0]?.staffMemberId ?? "");
  const [credentialType, setCredentialType] = useState<string>(STAFF_CREDENTIAL_TYPES[0]);
  const [expiresAt, setExpiresAt] = useState("");

  const onCreate = useCallback(() => {
    if (!selectedStaff) {
      setError("Select a staff member.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createStaffCredentialAction(tenantId, {
        staffMemberId: selectedStaff,
        credentialType,
        expiresAt: expiresAt || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Credential recorded.");
      router.refresh();
    });
  }, [credentialType, expiresAt, router, selectedStaff, tenantId]);

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Credentials</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Legal and regulatory credentials with expiry tracking. No hard deletes — audit history
          preserved.
        </p>
      </header>

      {error ? (
        <InfoNotice variant="warning" title="Action failed" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" title="Saved" className="mt-6">
          <p className="text-sm">{message}</p>
        </InfoNotice>
      ) : null}

      {canManage ? (
        <DashboardCard className="mt-6 p-5" elevated>
          <h2 className="text-sm font-semibold text-slate-100">Add credential</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <select
              className="rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-sm text-slate-200"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
            >
              {staffRows.map((s) => (
                <option key={s.staffMemberId} value={s.staffMemberId}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-sm text-slate-200"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
            >
              {STAFF_CREDENTIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-lg border border-white/10 bg-[#0c1426] px-3 py-2 text-sm text-slate-200"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              aria-label="Expiry date"
            />
          </div>
          <Button type="button" className="mt-4" disabled={pending} onClick={onCreate}>
            {pending ? "Saving…" : "Add credential"}
          </Button>
        </DashboardCard>
      ) : null}

      <div className="mt-6 space-y-4">
        {staffRows.map((staff) => (
          <DashboardCard key={staff.staffMemberId} className="p-5" elevated>
            <h3 className="font-medium text-slate-100">{staff.fullName}</h3>
            {staff.credentials.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No credentials on file.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {staff.credentials.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
                  >
                    <span className="text-slate-200">{c.displayName}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {c.status}
                      {c.expiresAt ? ` · ${new Date(c.expiresAt).toLocaleDateString()}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        ))}
      </div>
    </div>
  );
}