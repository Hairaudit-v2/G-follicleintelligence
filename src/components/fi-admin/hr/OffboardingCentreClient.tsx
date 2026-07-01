"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import { offboardStaffMemberAction } from "@/src/lib/actions/workforce-phase-1c-sprint-2-actions";

export type OffboardingStaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  roleCode: string | null;
  employmentStatus: string;
  fiStaffId: string | null;
};

export function OffboardingCentreClient({
  tenantId,
  activeStaff,
  offboardedStaff,
  canManage,
}: {
  tenantId: string;
  activeStaff: OffboardingStaffRow[];
  offboardedStaff: OffboardingStaffRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exitReason, setExitReason] = useState<Record<string, string>>({});

  const onOffboard = useCallback(
    (staffId: string) => {
      const reason = (exitReason[staffId] ?? "").trim();
      if (!reason) {
        setError("Exit reason is required.");
        return;
      }
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await offboardStaffMemberAction(tenantId, staffId, reason);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage("Staff member offboarded. Historical records preserved.");
        router.refresh();
      });
    },
    [exitReason, router, tenantId]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Offboarding Centre
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Terminate staff access and roster eligibility without deleting audit, compliance, or
          training history.
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
        </InfoNotice>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-100">Active staff</h2>
        <DashboardCard className="mt-3 overflow-x-auto p-0" elevated>
          <StaffOffboardingTable
            rows={activeStaff}
            canManage={canManage}
            pending={pending}
            exitReason={exitReason}
            onExitReasonChange={(id, value) =>
              setExitReason((prev) => ({ ...prev, [id]: value }))
            }
            onOffboard={onOffboard}
          />
        </DashboardCard>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-100">Recently offboarded</h2>
        <DashboardCard className="mt-3 overflow-x-auto p-0" elevated>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/[0.08] bg-[#0c1426]/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {offboardedStaff.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No offboarded staff in queue.
                  </td>
                </tr>
              ) : (
                offboardedStaff.map((row) => (
                  <tr key={row.id} className="text-slate-200">
                    <td className="px-4 py-3 font-medium">{row.fullName}</td>
                    <td className="px-4 py-3 text-slate-400">{row.email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-400">
                      {row.employmentStatus.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DashboardCard>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        <Link href={`/fi-admin/${tenantId}/staff`} className="text-cyan-400 hover:text-cyan-300">
          Workforce Command Centre
        </Link>
      </p>
    </div>
  );
}

function StaffOffboardingTable({
  rows,
  canManage,
  pending,
  exitReason,
  onExitReasonChange,
  onOffboard,
}: {
  rows: OffboardingStaffRow[];
  canManage: boolean;
  pending: boolean;
  exitReason: Record<string, string>;
  onExitReasonChange: (id: string, value: string) => void;
  onOffboard: (id: string) => void;
}) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-white/[0.08] bg-[#0c1426]/80 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3 font-medium">Name</th>
          <th className="px-4 py-3 font-medium">Email</th>
          <th className="px-4 py-3 font-medium">Role</th>
          <th className="px-4 py-3 font-medium">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.06]">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
              No active staff eligible for offboarding.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="text-slate-200">
              <td className="px-4 py-3 font-medium">{row.fullName}</td>
              <td className="px-4 py-3 text-slate-400">{row.email ?? "—"}</td>
              <td className="px-4 py-3 capitalize text-slate-400">
                {(row.roleCode ?? "—").replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3">
                {canManage ? (
                  <div className="flex min-w-[220px] flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Exit reason"
                      className="rounded-lg border border-white/[0.1] bg-[#0B1220] px-2 py-1.5 text-xs text-slate-200"
                      value={exitReason[row.id] ?? ""}
                      onChange={(e) => onExitReasonChange(row.id, e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => onOffboard(row.id)}
                    >
                      Offboard
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">View only</span>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}