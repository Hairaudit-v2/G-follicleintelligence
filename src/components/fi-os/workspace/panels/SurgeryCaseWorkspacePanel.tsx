"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadSurgeryCaseWorkspaceBundleAction } from "@/lib/actions/fi-workspace-shell-actions";
import type { SurgeryCaseWorkspacePayload } from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

import type { WorkspacePanelSignalRefresh } from "@/src/components/fi-os/workspace/useWorkspacePanelSignalRefresh";

import {
  WorkspaceShellContextCard,
  WorkspaceShellPanelFrame,
  workspacePanelActionClass,
} from "./WorkspaceShellPanelFrame";

type SurgeryCaseWorkspacePanelProps = WorkspacePanelSignalRefresh & {
  tenantId: string;
  caseId: string | null;
  open: boolean;
  onClose: () => void;
};

export function SurgeryCaseWorkspacePanel({
  tenantId,
  caseId,
  open,
  onClose,
  signalRefreshToken = 0,
  lastSignalReason,
  lastSignalAt,
}: SurgeryCaseWorkspacePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<SurgeryCaseWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !caseId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadSurgeryCaseWorkspaceBundleAction(tenantId, caseId).then((r) => {
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
  }, [open, caseId, tenantId, signalRefreshToken]);

  const actions =
    payload && !loading && !loadError ? (
      <div className="flex flex-wrap gap-2">
        <Link
          href={payload.fullPageHref}
          className={workspacePanelActionClass()}
          onClick={() => onClose()}
        >
          Complete checklist
        </Link>
        {payload.surgeryDayHref ? (
          <Link
            href={payload.surgeryDayHref}
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            Open surgery day
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
      ariaLabel="Surgery case preview"
      title="Surgery case"
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
          <WorkspaceShellContextCard heading="Case">
            <p className="font-medium text-slate-100">{payload.title}</p>
            <p className="mt-1 text-xs text-slate-400">{payload.patientLabel}</p>
            <dl className="mt-3 grid gap-2">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{payload.status.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Readiness</dt>
                <dd className="text-sm text-slate-300">{payload.blockerSummary}</dd>
              </div>
            </dl>
          </WorkspaceShellContextCard>
        </div>
      ) : null}
    </WorkspaceShellPanelFrame>
  );
}
