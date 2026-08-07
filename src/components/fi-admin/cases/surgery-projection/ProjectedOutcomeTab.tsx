"use client";

import { useMemo, useState, useTransition } from "react";
import type { SurgeryProjectionReadiness } from "@/src/lib/cases/surgeryProjection/readiness";
import type { HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION } from "@/src/lib/imaging-os/sharedProjection/externalAssetPolicy";
import type { PilotPreflightRecord } from "@/src/lib/imaging-os/sharedProjection/pilotTypes";
import {
  fiConfirmProjectedOutcomeGenerationAction,
  fiRequestProjectedOutcomePreflightAction,
  fiSetProjectedOutcomeReviewAction,
} from "@/lib/actions/fi-surgery-projection-actions";

export type SharedOutcomeViewModel = {
  sharedGenerationId: string;
  lifecycleStatus: string;
  outputUrl: string | null;
  sourceUrl: string | null;
  hairlineLabel: string;
  allocationLabel: string;
  providerId: string;
  modelVersion: string;
  planVersion: number;
  hairlineVersion: number;
  technicalWarnings: string[];
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  localReviewStatus: string;
};

export function ProjectedOutcomeTab({
  readiness,
  patientSubjectRef,
  externalInspection,
  externalLabel,
  disclaimer,
  tenantId,
  caseId,
  actorUserId,
  actorRole,
  sharedOutcome,
}: {
  readiness: SurgeryProjectionReadiness;
  patientSubjectRef: string | null;
  externalInspection: typeof HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION;
  externalLabel: string;
  disclaimer: string;
  tenantId: string;
  caseId: string;
  actorUserId: string | null;
  actorRole: string | null;
  sharedOutcome: SharedOutcomeViewModel | null;
}) {
  const [pending, startTransition] = useTransition();
  const [preflight, setPreflight] = useState<PilotPreflightRecord | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [slider, setSlider] = useState(50);
  const [zoom, setZoom] = useState(1);

  const canAct = Boolean(actorUserId);

  const comparisonStyle = useMemo(
    () => ({
      clipPath: `inset(0 ${100 - slider}% 0 0)`,
    }),
    [slider]
  );

  return (
    <div className="space-y-4 text-xs text-slate-300">
      <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="text-sm font-medium text-slate-100">Illustrative Projected Outcome</div>
        <p className="mt-1 text-slate-400">
          Lifecycle hint: <span className="text-slate-200">{readiness.lifecycleHint}</span>
        </p>
        <ul className="mt-2 space-y-1">
          <li>Plan approved: {readiness.planApproved ? "yes" : "no"}</li>
          <li>Hairline approved: {readiness.hairlineApproved ? "yes" : "no"}</li>
          <li>Can request generation: {readiness.canRequestGeneration ? "yes" : "no"}</li>
          <li>Patient sharing: unavailable (deferred)</li>
        </ul>
        {readiness.blockers.length > 0 ? (
          <ul className="mt-2 space-y-1 text-amber-100">
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !readiness.canRequestGeneration || !canAct}
            className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-white/[0.04] disabled:opacity-40"
            onClick={() => {
              startTransition(async () => {
                const r = await fiRequestProjectedOutcomePreflightAction({
                  tenantId,
                  caseId,
                  actorUserId,
                  actorRole,
                });
                if (!r.ok) {
                  setStatusMsg(r.error);
                  setPreflight(null);
                  return;
                }
                setPreflight(r.preflight);
                setStatusMsg(r.status);
              });
            }}
          >
            Show pilot preflight
          </button>
          <button
            type="button"
            disabled={pending || !preflight || !canAct}
            className="rounded border border-emerald-700/60 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-900/20 disabled:opacity-40"
            onClick={() => {
              if (!actorUserId || !preflight) return;
              startTransition(async () => {
                const r = await fiConfirmProjectedOutcomeGenerationAction({
                  tenantId,
                  caseId,
                  actorUserId,
                  actorRole,
                  costAcknowledged: true,
                });
                setStatusMsg(
                  r.ok
                    ? `Generated ${r.sharedGenerationId.slice(0, 8)}… (${r.lifecycleStatus})`
                    : r.error
                );
              });
            }}
          >
            Confirm paid generation
          </button>
        </div>
        {preflight ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-slate-500">Tenant</dt>
            <dd className="font-mono">{preflight.tenantId.slice(0, 8)}…</dd>
            <dt className="text-slate-500">Case</dt>
            <dd className="font-mono">{(preflight.caseId ?? "—").toString().slice(0, 8)}…</dd>
            <dt className="text-slate-500">Plan</dt>
            <dd>
              {preflight.planId.slice(0, 8)}… v{preflight.planVersion}
            </dd>
            <dt className="text-slate-500">Hairline</dt>
            <dd>
              {preflight.hairlineId.slice(0, 8)}… v{preflight.hairlineVersion}
            </dd>
            <dt className="text-slate-500">Source</dt>
            <dd className="truncate">{preflight.sourceImageRef}</dd>
            <dt className="text-slate-500">Mask checksum</dt>
            <dd className="font-mono">{preflight.treatmentMaskChecksum.slice(0, 12)}…</dd>
            <dt className="text-slate-500">Graft total</dt>
            <dd>{preflight.graftTotal}</dd>
            <dt className="text-slate-500">Est. cost</dt>
            <dd>${preflight.estimatedCostUsd.toFixed(2)}</dd>
            <dt className="text-slate-500">DPIA</dt>
            <dd>{preflight.dpiaStatus}</dd>
          </dl>
        ) : null}
        {statusMsg ? <p className="mt-2 text-[11px] text-slate-400">{statusMsg}</p> : null}
      </div>

      {sharedOutcome ? (
        <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-100">Clinical inspection</div>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={showMask}
                  onChange={(e) => setShowMask(e.target.checked)}
                />
                Mask overlay
              </label>
              <label className="flex items-center gap-1 text-[11px]">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div
            className="relative overflow-hidden rounded border border-white/[0.06] bg-black/40"
            style={{ height: 320 }}
          >
            {sharedOutcome.sourceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sharedOutcome.sourceUrl}
                alt="Original"
                className="absolute inset-0 h-full w-full object-contain"
                style={{ transform: `scale(${zoom})` }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                Original unavailable
              </div>
            )}
            {sharedOutcome.outputUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sharedOutcome.outputUrl}
                alt="Projected outcome"
                className="absolute inset-0 h-full w-full object-contain"
                style={{ ...comparisonStyle, transform: `scale(${zoom})` }}
              />
            ) : null}
            {showMask ? (
              <div className="pointer-events-none absolute inset-0 bg-emerald-400/10 mix-blend-screen" />
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            Before / after
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="flex-1"
            />
          </label>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-slate-500">Generation</dt>
            <dd className="font-mono">{sharedOutcome.sharedGenerationId.slice(0, 8)}…</dd>
            <dt className="text-slate-500">Lifecycle</dt>
            <dd>{sharedOutcome.lifecycleStatus}</dd>
            <dt className="text-slate-500">Hairline</dt>
            <dd>{sharedOutcome.hairlineLabel}</dd>
            <dt className="text-slate-500">Allocation</dt>
            <dd>{sharedOutcome.allocationLabel}</dd>
            <dt className="text-slate-500">Plan / hairline ver</dt>
            <dd>
              v{sharedOutcome.planVersion} / v{sharedOutcome.hairlineVersion}
            </dd>
            <dt className="text-slate-500">Provider</dt>
            <dd>
              {sharedOutcome.providerId} / {sharedOutcome.modelVersion}
            </dd>
            <dt className="text-slate-500">Cost / latency</dt>
            <dd>
              {sharedOutcome.estimatedCostUsd != null
                ? `$${sharedOutcome.estimatedCostUsd.toFixed(2)}`
                : "—"}{" "}
              · {sharedOutcome.latencyMs != null ? `${sharedOutcome.latencyMs}ms` : "—"}
            </dd>
            <dt className="text-slate-500">Local review</dt>
            <dd>{sharedOutcome.localReviewStatus}</dd>
          </dl>
          {sharedOutcome.technicalWarnings.length ? (
            <ul className="text-[11px] text-amber-100 space-y-1">
              {sharedOutcome.technicalWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["clinically_accepted", "Approve for FiOS clinical use"],
                ["clinically_rejected", "Reject"],
                ["correction_requested", "Request correction"],
                ["accepted_for_review", "Accept for review"],
              ] as const
            ).map(([decision, label]) => (
              <button
                key={decision}
                type="button"
                disabled={pending || !actorUserId}
                className="rounded border border-slate-600 px-2 py-1 text-[11px] hover:bg-white/[0.04] disabled:opacity-40"
                onClick={() => {
                  if (!actorUserId) return;
                  startTransition(async () => {
                    const r = await fiSetProjectedOutcomeReviewAction({
                      tenantId,
                      caseId,
                      sharedGenerationId: sharedOutcome.sharedGenerationId,
                      actorUserId,
                      actorRole,
                      decision,
                    });
                    setStatusMsg(r.ok ? `FiOS decision: ${decision}` : r.error);
                  });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            FiOS decisions do not mutate HairAudit review state. Patient sharing remains blocked.
          </p>
        </div>
      ) : null}

      <div className="rounded border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="font-medium text-slate-100">Isolated HairAudit rejected asset</div>
        <p className="mt-1 text-slate-400">{externalLabel}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-slate-500">HA id</dt>
          <dd className="font-mono">{externalInspection.id.slice(0, 8)}…</dd>
          <dt className="text-slate-500">Rejection</dt>
          <dd>{externalInspection.rejectionReason}</dd>
          <dt className="text-slate-500">Seam at mask boundary</dt>
          <dd>{externalInspection.seamAtMaskBoundary ? "likely yes" : "unknown"}</dd>
          <dt className="text-slate-500">Likely cause</dt>
          <dd>{externalInspection.likelyRootCause}</dd>
        </dl>
        <p className="mt-2 text-[11px] text-rose-200/90">
          Not displayed as a current FiOS outcome. Immutable provenance retained. Not shareable.
        </p>
        {patientSubjectRef ? (
          <p className="mt-1 text-[11px] text-slate-500">
            FiOS subject ref: {patientSubjectRef.slice(0, 8)}…
          </p>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">{disclaimer}</p>
    </div>
  );
}
