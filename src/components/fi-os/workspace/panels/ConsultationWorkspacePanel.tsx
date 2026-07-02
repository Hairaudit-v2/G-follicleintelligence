"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadConsultationWorkspaceBundleAction } from "@/lib/actions/fi-workspace-shell-actions";
import type { ConsultationWorkspacePayload } from "@/src/lib/fiOs/workspaceShell/workspaceShellLoaders.server";

import {
  WorkspaceShellContextCard,
  WorkspaceShellPanelFrame,
  workspacePanelActionClass,
} from "./WorkspaceShellPanelFrame";

type ConsultationWorkspacePanelProps = {
  tenantId: string;
  consultationId: string | null;
  open: boolean;
  onClose: () => void;
};

export function ConsultationWorkspacePanel({
  tenantId,
  consultationId,
  open,
  onClose,
}: ConsultationWorkspacePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ConsultationWorkspacePayload | null>(null);

  useEffect(() => {
    if (!open || !consultationId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadConsultationWorkspaceBundleAction(tenantId, consultationId).then((r) => {
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
  }, [open, consultationId, tenantId]);

  const actions =
    payload && !loading && !loadError ? (
      <div className="flex flex-wrap gap-2">
        {payload.primaryActionHref && payload.primaryActionLabel ? (
          <Link
            href={payload.primaryActionHref}
            className={workspacePanelActionClass()}
            onClick={() => onClose()}
          >
            {payload.primaryActionLabel}
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
      ariaLabel="Consultation preview"
      title="Consultation"
      fullPageHref={payload?.fullPageHref}
      open={open}
      onClose={onClose}
      loading={loading}
      loadError={loadError}
      actions={actions}
    >
      {payload ? (
        <div className="space-y-4 pb-24">
          <WorkspaceShellContextCard heading="Consultation">
            <p className="font-medium text-slate-100">{payload.title}</p>
            <p className="mt-1 text-xs text-slate-400">{payload.typeLabel}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className="font-medium capitalize">{payload.status}</dd>
              </div>
              {payload.appointmentLabel ? (
                <div>
                  <dt className="text-xs text-gray-500">Appointment</dt>
                  <dd className="font-medium">{payload.appointmentLabel}</dd>
                </div>
              ) : null}
            </dl>
          </WorkspaceShellContextCard>
        </div>
      ) : null}
    </WorkspaceShellPanelFrame>
  );
}
