"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { HrOsSubNav } from "@/src/components/fi/hr-os/HrOsSubNav";
import { manuallyLinkStaffIdentityAction } from "@/src/lib/actions/workforce-phase-1c-sprint-2-actions";
import type {
  ExternalStaffIdentityOption,
  StaffReconciliationPageModel,
} from "@/src/lib/workforce/staffReconciliationPage.server";

export function StaffReconciliationClient({
  tenantId,
  model,
  canManage,
}: {
  tenantId: string;
  model: StaffReconciliationPageModel;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedExternal, setSelectedExternal] = useState<Record<string, string>>({});

  const externalOptions = model.availableExternalIdentities;

  const onLink = useCallback(
    (staffMemberId: string) => {
      setError(null);
      setMessage(null);
      const raw = selectedExternal[staffMemberId];
      if (!raw) {
        setError("Select an external identity before linking.");
        return;
      }
      const [sourceSystem, externalId] = raw.split("::");
      if (!sourceSystem || !externalId) {
        setError("Invalid external identity selection.");
        return;
      }

      startTransition(async () => {
        const result = await manuallyLinkStaffIdentityAction(
          tenantId,
          staffMemberId,
          sourceSystem,
          externalId
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage("Identity linked successfully.");
        router.refresh();
      });
    },
    [router, selectedExternal, tenantId]
  );

  return (
    <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <HrOsSubNav tenantId={tenantId} />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Staff Reconciliation
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Manually link active FI staff members to external IIOHR identities. No automatic merges —
          every link is auditable.
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

      <DashboardCard className="mt-8 overflow-x-auto p-0" elevated>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/[0.08] bg-[#0c1426]/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Employment Status</th>
              <th className="px-4 py-3 font-medium">External Match Suggestions</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {model.unlinkedStaff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  All active staff have HR identity links.
                </td>
              </tr>
            ) : (
              model.unlinkedStaff.map((row) => (
                <tr key={row.id} className="text-slate-200">
                  <td className="px-4 py-3 font-medium">{row.fullName}</td>
                  <td className="px-4 py-3 text-slate-400">{row.email ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-400">
                    {(row.roleCode ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-400">
                    {row.employmentStatus.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    {row.matchSuggestions.length ? (
                      <ul className="space-y-1 text-xs text-slate-400">
                        {row.matchSuggestions.map((s) => (
                          <li key={`${s.sourceSystem}-${s.externalId}`}>
                            {s.externalName ?? s.externalId} · {s.score}% match
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-500">No suggestions</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex min-w-[200px] flex-col gap-2">
                        <select
                          className="rounded-lg border border-white/[0.1] bg-[#0B1220] px-2 py-1.5 text-xs text-slate-200"
                          value={selectedExternal[row.id] ?? ""}
                          onChange={(e) =>
                            setSelectedExternal((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select external identity…</option>
                          {externalOptions.map((opt) => (
                            <option
                              key={`${opt.sourceSystem}::${opt.externalId}`}
                              value={`${opt.sourceSystem}::${opt.externalId}`}
                            >
                              {formatExternalOption(opt)}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => onLink(row.id)}
                        >
                          Link Identity
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
      </DashboardCard>

      <p className="mt-4 text-xs text-slate-500">
        <Link
          href={`/fi-admin/${tenantId}/hr-os/sync-health`}
          className="text-cyan-400 hover:text-cyan-300"
        >
          View sync health
        </Link>
        {" · "}
        <Link
          href={`/fi-admin/${tenantId}/hr-os/duplicates`}
          className="text-cyan-400 hover:text-cyan-300"
        >
          Review duplicates
        </Link>
      </p>
    </div>
  );
}

function formatExternalOption(opt: ExternalStaffIdentityOption): string {
  const label = opt.externalName ?? opt.externalId;
  const email = opt.externalEmail ? ` · ${opt.externalEmail}` : "";
  return `${label}${email} (${opt.sourceSystem})`;
}