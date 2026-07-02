"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadStaffWorkspaceBundleAction } from "@/lib/actions/fi-workspace-shell-actions";
import type { StaffWorkspacePayload } from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

import type { WorkspacePanelSignalRefresh } from "@/src/components/fi-os/workspace/useWorkspacePanelSignalRefresh";

import {
  WorkspaceShellContextCard,
  WorkspaceShellPanelFrame,
  workspacePanelActionClass,
} from "./WorkspaceShellPanelFrame";

type StaffWorkspacePanelProps = WorkspacePanelSignalRefresh & {
  tenantId: string;
  staffId: string | null;
  open: boolean;
  onClose: () => void;
};

export function StaffWorkspacePanel({
  tenantId,
  staffId,
  open,
  onClose,
  signalRefreshToken = 0,
  lastSignalReason,
  lastSignalAt,
}: StaffWorkspacePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StaffWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !staffId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadStaffWorkspaceBundleAction(tenantId, staffId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setPayload(null);
        setLoadError(r.error);
        return;
      }
      setPayload(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, staffId, tenantId, signalRefreshToken]);

  const actions =
    payload && !loading && !loadError ? (
      <div className="flex flex-wrap gap-2">
        <Link
          href={payload.profileHref}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Open profile
        </Link>
        {payload.accessHref ? (
          <Link
            href={payload.accessHref}
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            Manage access
          </Link>
        ) : null}
        <Link
          href={payload.fullPageHref}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Open full page
        </Link>
      </div>
    ) : null;

  return (
    <WorkspaceShellPanelFrame
      ariaLabel="Staff preview"
      title="Staff"
      fullPageHref={payload?.fullPageHref}
      open={open}
      onClose={onClose}
      loading={loading}
      loadError={loadError}
      actions={actions}
      lastSignalReason={lastSignalReason}
      lastSignalAt={lastSignalAt}
      signalRefreshToken={signalRefreshToken}
    >
      {payload ? (
        <div className="space-y-4 pb-24">
          <WorkspaceShellContextCard heading="Team member">
            <p className="font-medium text-slate-100">{payload.displayName}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {payload.role ? (
                <div>
                  <dt className="text-xs text-gray-500">Role</dt>
                  <dd className="font-medium capitalize">{payload.role.replace(/_/g, " ")}</dd>
                </div>
              ) : null}
              {payload.employmentStatus ? (
                <div>
                  <dt className="text-xs text-gray-500">Status</dt>
                  <dd className="font-medium capitalize">
                    {payload.employmentStatus.replace(/_/g, " ")}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Compliance</dt>
                <dd className="text-sm text-slate-300">{payload.complianceSummary}</dd>
              </div>
            </dl>
          </WorkspaceShellContextCard>
        </div>
      ) : null}
    </WorkspaceShellPanelFrame>
  );
}
