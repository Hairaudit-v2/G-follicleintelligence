"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  applySandboxSeedAction,
  finalizeOnboardingSessionAction,
  loadSandboxSeedPreviewAction,
  markOnboardingReadyForReviewAction,
  retryOnboardingStepAction,
  runAllOnboardingStepsAction,
  runOnboardingStepAction,
} from "@/lib/actions/fi-onboarding-os-provisioning-actions";
import {
  listSandboxSeedPackSummaries,
  SANDBOX_SEED_PACK_CODES,
} from "@/src/lib/onboarding-os/sandboxSeedCatalog";
import {
  canRetryProvisioningStep,
  resolveProvisioningStatusBadge,
  resolveProvisioningStepStatusBadge,
} from "@/src/lib/onboarding-os/tenantProvisioningCore";
import type {
  ClinicDeploymentPlan,
  ProvisioningSessionStatus,
  ProvisioningStepStatus,
  SandboxSeedHistoryEntry,
  SandboxSeedPackCode,
  SandboxSeedPreview,
  TemplateReadinessResult,
} from "@/src/lib/onboarding-os/tenantProvisioningTypes";
import type { TenantProvisioningStepRow } from "@/src/lib/onboarding-os/tenantProvisioning.server";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[tone] ?? BADGE_CLASSES.neutral}`}
    >
      {label}
    </span>
  );
}

type Props = {
  sessionId: string;
  tenantName: string;
  tenantSlug: string;
  tenantId: string | null;
  sessionStatus: ProvisioningSessionStatus;
  progressPercent: number;
  errorMessage: string | null;
  steps: TenantProvisioningStepRow[];
  deploymentPlan: ClinicDeploymentPlan | null;
  templateReadiness: TemplateReadinessResult | null;
  sandboxSeedPreview: SandboxSeedPreview | null;
  sandboxSeedHistory: SandboxSeedHistoryEntry[];
};

export function OnboardingSessionDetailClient({
  sessionId,
  tenantName,
  tenantSlug,
  tenantId,
  sessionStatus,
  progressPercent,
  errorMessage,
  steps,
  deploymentPlan,
  templateReadiness,
  sandboxSeedPreview,
  sandboxSeedHistory,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedPack, setSelectedPack] = useState<SandboxSeedPackCode>(
    sandboxSeedPreview?.plan.packCode ?? "standard_demo"
  );
  const [preview, setPreview] = useState<SandboxSeedPreview | null>(sandboxSeedPreview);
  const [history, setHistory] = useState<SandboxSeedHistoryEntry[]>(sandboxSeedHistory);
  const [forceApply, setForceApply] = useState(false);
  const packSummaries = listSandboxSeedPackSummaries();

  const sessionBadge = resolveProvisioningStatusBadge(sessionStatus);
  const isClosed = sessionStatus === "completed" || sessionStatus === "cancelled";

  function runAction(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error ?? `${label} failed.` });
        return;
      }
      setMessage({ kind: "ok", text: `${label} succeeded.` });
      router.refresh();
    });
  }

  function refreshPreview(packCode: SandboxSeedPackCode) {
    setSelectedPack(packCode);
    startTransition(async () => {
      const res = await loadSandboxSeedPreviewAction(sessionId, packCode);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      setPreview(res.preview);
      setHistory(res.history);
    });
  }

  function applySandboxSeed() {
    setMessage(null);
    startTransition(async () => {
      const res = await applySandboxSeedAction({
        sessionId,
        packCode: selectedPack,
        force: forceApply,
      });
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error ?? "Sandbox seed apply failed." });
        return;
      }
      setMessage({ kind: "ok", text: "Sandbox demo data applied." });
      router.refresh();
    });
  }

  const sandboxEnabled = deploymentPlan?.sandboxSeed.enabled ?? false;
  const canApplySeed = sandboxEnabled && !!tenantId && !isClosed;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{tenantName}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{tenantSlug}</p>
          </div>
          <StatusBadge label={sessionBadge.label} tone={sessionBadge.tone} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {errorMessage ? <p className="mt-3 text-sm text-red-400">{errorMessage}</p> : null}
        {message ? (
          <p
            className={
              message.kind === "ok" ? "mt-3 text-sm text-emerald-400" : "mt-3 text-sm text-red-400"
            }
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        {tenantId ? (
          <p className="mt-3 text-sm text-slate-400">
            Tenant:{" "}
            <Link
              href={`/fi-admin/${tenantId}`}
              className="font-mono text-cyan-400 hover:text-cyan-300"
            >
              {tenantId}
            </Link>
          </p>
        ) : null}

        {!isClosed ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction("Run all core steps", () => runAllOnboardingStepsAction(sessionId))
              }
              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              Run all core steps
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction("Mark ready for review", () =>
                  markOnboardingReadyForReviewAction(sessionId)
                )
              }
              className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Ready for review
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction("Finalize", () => finalizeOnboardingSessionAction(sessionId))
              }
              className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              Finalize provisioning
            </button>
          </div>
        ) : null}
      </section>

      {deploymentPlan ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Deployment template</h3>
              <p className="mt-1 text-sm text-slate-300">{deploymentPlan.templateDisplayName}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-600">
                {deploymentPlan.templateCode}
              </p>
            </div>
            {templateReadiness ? (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  templateReadiness.ready
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {templateReadiness.score}% {templateReadiness.ready ? "Ready" : "Review"}
              </span>
            ) : null}
          </div>

          {templateReadiness?.issues.length ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-400">
              {templateReadiness.issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-500">Modules</dt>
              <dd className="mt-1 text-slate-300">
                {deploymentPlan.moduleBundle.enabledModules.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Roles</dt>
              <dd className="mt-1 text-slate-300">
                {[
                  deploymentPlan.rolePack.primaryAdminRole,
                  ...deploymentPlan.rolePack.additionalRoles,
                ].join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Services</dt>
              <dd className="mt-1 text-slate-300">
                {deploymentPlan.serviceTemplates.map((s) => s.name).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Workflows</dt>
              <dd className="mt-1 text-slate-300">
                {deploymentPlan.workflowTemplates.map((w) => w.name).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Academy tracks</dt>
              <dd className="mt-1 text-slate-300">
                {deploymentPlan.academyAssignments.length
                  ? deploymentPlan.academyAssignments.map((a) => a.trackName).join(", ")
                  : "None"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Sandbox seed</dt>
              <dd className="mt-1 text-slate-300">
                {deploymentPlan.sandboxSeed.enabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {sandboxEnabled ? (
        <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Sandbox demo data</h3>
              <p className="mt-1 text-xs text-slate-500">
                Preview and apply obviously fake training data. Blocked after go-live (session
                finalized).
              </p>
            </div>
            {preview ? (
              <span className="inline-flex rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                {preview.plan.totalRecords} records
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-xs text-slate-400">
              Seed pack
              <select
                value={selectedPack}
                disabled={pending}
                onChange={(ev) => refreshPreview(ev.target.value as SandboxSeedPackCode)}
                className="mt-1 block w-full min-w-[220px] rounded-lg border border-white/[0.08] bg-[#0a1220] px-3 py-2 text-sm text-slate-200"
              >
                {SANDBOX_SEED_PACK_CODES.map((code) => {
                  const summary = packSummaries.find((p) => p.code === code);
                  return (
                    <option key={code} value={code}>
                      {summary?.displayName ?? code}
                    </option>
                  );
                })}
              </select>
            </label>
            {canApplySeed ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={forceApply}
                    onChange={(ev) => setForceApply(ev.target.checked)}
                    className="rounded border-white/20"
                  />
                  Force re-apply
                </label>
                <button
                  type="button"
                  disabled={pending || (preview?.alreadyApplied && !forceApply)}
                  onClick={applySandboxSeed}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Apply sandbox seed
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-400">
                {!tenantId
                  ? "Provision tenant core before applying seed."
                  : "Session is closed — seed apply disabled."}
              </p>
            )}
          </div>

          {preview?.alreadyApplied && !forceApply ? (
            <p className="mt-3 text-xs text-amber-400">
              This pack was already applied for this session. Enable force re-apply to insert again
              (idempotent keys skip duplicates).
            </p>
          ) : null}

          {preview ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Entity</th>
                    <th className="px-3 py-2 font-medium">Count</th>
                    <th className="px-3 py-2 font-medium">Included</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-slate-300">
                  {preview.plan.entities.map((row) => (
                    <tr key={row.entityType}>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 font-mono">{row.count}</td>
                      <td className="px-3 py-2">{row.included ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {history.length ? (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-400">Seed history</h4>
              <ul className="mt-2 space-y-2">
                {history.map((entry, idx) => (
                  <li
                    key={`${entry.packCode}-${entry.appliedAt}-${idx}`}
                    className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400"
                  >
                    <span className="font-medium text-slate-300">{entry.packCode}</span>
                    <span className="mx-2">·</span>
                    <span>{new Date(entry.appliedAt).toLocaleString()}</span>
                    <span className="mx-2">·</span>
                    <span>
                      {Object.entries(entry.entityCounts)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-slate-200">Provisioning steps</h3>
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#060d18]/80">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              disabled={pending || isClosed}
              onRun={(stepCode) =>
                runAction(`Run ${stepCode}`, () => runOnboardingStepAction(sessionId, stepCode))
              }
              onRetry={(stepCode) =>
                runAction(`Retry ${stepCode}`, () => retryOnboardingStepAction(sessionId, stepCode))
              }
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function StepRow({
  step,
  disabled,
  onRun,
  onRetry,
}: {
  step: TenantProvisioningStepRow;
  disabled: boolean;
  onRun: (stepCode: string) => void;
  onRetry: (stepCode: string) => void;
}) {
  const badge = resolveProvisioningStepStatusBadge(step.status as ProvisioningStepStatus);
  const label = String((step.input_snapshot as { label?: string }).label ?? step.step_code);
  const canRetry = canRetryProvisioningStep({
    status: step.status,
    attemptCount: step.attempt_count,
    maxAttempts: step.max_attempts,
  });
  const canRun = step.status === "pending" || step.status === "retry_pending";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-100">{label}</p>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>
        <p className="mt-0.5 font-mono text-xs text-slate-600">{step.step_code}</p>
        {step.error_message ? (
          <p className="mt-1 text-xs text-red-400">{step.error_message}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {canRun ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRun(step.step_code)}
            className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1] disabled:opacity-50"
          >
            Run
          </button>
        ) : null}
        {canRetry ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRetry(step.step_code)}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Retry
          </button>
        ) : null}
      </div>
    </li>
  );
}
