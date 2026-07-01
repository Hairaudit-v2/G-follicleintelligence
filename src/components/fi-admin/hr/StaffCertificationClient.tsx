"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import {
  createCertificationAction,
  verifyCertificationAction,
} from "@/src/lib/actions/workforce-phase-1c-sprint-3-actions";
import type { CertificationsPageStaffRow } from "@/src/lib/workforce/certificationsPage.server";
import { STAFF_CERTIFICATION_EXAMPLES } from "@/src/lib/workforce/workforceClinicalTypes";

export function StaffCertificationClient({
  tenantId,
  staffRows,
  canManage,
}: {
  tenantId: string;
  staffRows: CertificationsPageStaffRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState(staffRows[0]?.staffMemberId ?? "");
  const [certName, setCertName] = useState<string>(STAFF_CERTIFICATION_EXAMPLES[0]);
  const [expiresAt, setExpiresAt] = useState("");

  const onCreate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createCertificationAction(tenantId, {
        staffMemberId: selectedStaff,
        certificationName: certName,
        expiresAt: expiresAt || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }, [certName, expiresAt, router, selectedStaff, tenantId]);

  const onVerify = useCallback(
    (certificationId: string, verified: boolean) => {
      startTransition(async () => {
        const result = await verifyCertificationAction(tenantId, certificationId, verified);
        if (!result.ok) setError(result.error);
        else router.refresh();
      });
    },
    [router, tenantId]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Certifications</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Clinical procedure certifications — expired certifications reduce clinical eligibility
          score.
        </p>
      </header>

      {error ? (
        <InfoNotice variant="warning" title="Action failed" className="mt-6">
          <p className="text-sm">{error}</p>
        </InfoNotice>
      ) : null}

      {canManage ? (
        <DashboardCard className="mt-6 p-5" elevated>
          <h2 className="text-sm font-semibold text-slate-100">Add certification</h2>
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
              value={certName}
              onChange={(e) => setCertName(e.target.value)}
            >
              {STAFF_CERTIFICATION_EXAMPLES.map((t) => (
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
            Add certification
          </Button>
        </DashboardCard>
      ) : null}

      <div className="mt-6 space-y-4">
        {staffRows.map((staff) => (
          <DashboardCard key={staff.staffMemberId} className="p-5" elevated>
            <h3 className="font-medium text-slate-100">{staff.fullName}</h3>
            {staff.certifications.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No certifications recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {staff.certifications.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-slate-200">{c.certificationName}</span>
                      {c.isExpired ? (
                        <span className="ml-2 text-xs text-rose-400">Expired</span>
                      ) : c.isExpiringSoon ? (
                        <span className="ml-2 text-xs text-amber-300">Expiring soon</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {c.verified ? "Verified" : "Unverified"}
                      </span>
                      {canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => onVerify(c.id, !c.verified)}
                        >
                          {c.verified ? "Revoke" : "Verify"}
                        </Button>
                      ) : null}
                    </div>
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