import Link from "next/link";

import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { canExecuteGovernedReplayRun, isFiIntelligenceGovernedDispatchEnabled } from "@/src/lib/fi/events/governedReplayEnv";
import { isStagingIntelligenceActivationEnabled } from "@/src/lib/fi/events/stagingActivationEnv";
import { getStagingActivationAllowedEvents } from "@/src/lib/fi/events/stagingActivationAllowlist";
import { loadIntelligenceReplayRunsForAdmin } from "@/src/lib/fi/events/loadIntelligenceReplayRunsForAdmin.server";
import { replayIntelligenceEventLogs } from "@/src/lib/fi/events/replayIntelligenceEventLogs.server";

export const dynamic = "force-dynamic";

export default async function IntelligenceEventLogReplayRunsPage() {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env.NODE_ENV ?? "";
  const governedReplay = canExecuteGovernedReplayRun({ env, nodeEnv });
  const governedDispatchFlag = isFiIntelligenceGovernedDispatchEnabled({ env, nodeEnv });
  const stagingActivation = isStagingIntelligenceActivationEnabled({ env, nodeEnv });
  const stagingAllowedEvents = getStagingActivationAllowedEvents();
  const isProd = nodeEnv === "production";

  const [runs, templateDryRun] = await Promise.all([
    loadIntelligenceReplayRunsForAdmin({ limit: 50 }),
    replayIntelligenceEventLogs({
      mode: "dry_run",
      filters: { limit: 25, order: "newest_first", event_name: "hairaudit.audit.completed", privacy_level: "internal_debug" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>Intelligence core</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Governed replay runs (Stage 15 / 17)</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Durable plans in <code className="text-xs text-slate-300">public.fi_intelligence_replay_runs</code> with draft →
          approval → execute. Execution stays on safe Stage 14 modes only; <strong className="text-slate-200">dispatch_future</strong>{" "}
          is blocked in app code. No production dispatch controls are exposed here.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <Link href="/fi-admin/system/intelligence-event-logs" className="text-[#22C1FF] hover:underline">
            ← Intelligence event logs
          </Link>
        </p>
      </div>

      <aside className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs text-amber-100/90">
        <strong className="text-amber-100">Production governance required.</strong> Cross-system dispatch and production
        persistence remain off until org sign-off. <strong className="text-amber-100">No production activation</strong> for
        staging replay rehearsal — follow{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-50/95">
          docs/stage18-staging-replay-validation-runbook.md
        </code>{" "}
        and{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-50/95">
          docs/stage18-staging-replay-release-checklist.md
        </code>
        . Repo docs:{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-50/95">docs/governance/README.md</code>,{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-50/95">
          docs/governance/environment-activation-checklist.md
        </code>
        ,{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px] text-amber-50/95">
          docs/governance/legal-privacy-review-checklist.md
        </code>
        .
      </aside>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Environment gates</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
          <li>
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED</code> —{" "}
            <strong className="text-slate-200">{governedReplay ? "on (execute allowed)" : "off (default)"}</strong>
          </li>
          <li>
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED</code> —{" "}
            <strong className="text-slate-200">{governedDispatchFlag ? "set" : "unset"}</strong> (reserved; no Stage 15
            dispatch implementation)
          </li>
          <li>
            NODE_ENV — <strong className="text-slate-200">{nodeEnv || "(empty)"}</strong>
            {isProd ? (
              <span className="text-amber-300/90"> — production: shadow enqueue remains hard-off per Stage 12/14 policy.</span>
            ) : null}
          </li>
          <li>
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED</code> +{" "}
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_STAGING_ALLOWED_EVENT</code> —{" "}
            <strong className="text-slate-200">{stagingActivation ? "staging path eligible" : "off (default)"}</strong>
            {isProd ? (
              <span className="text-amber-300/90"> — staging activation is always false in production.</span>
            ) : null}
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-cyan-200/90">Stage 17 — staging activation (no UI trigger)</h2>
        <p className="mt-2 text-slate-400">
          One explicit staging-only path unlocks <strong className="text-slate-200">CLI</strong> execution of an{" "}
          <strong className="text-slate-200">approved</strong> governed run in <strong className="text-slate-200">enqueue_shadow</strong>{" "}
          only, for allow-listed events below. There is <strong className="text-slate-200">no browser activation button</strong> yet; use env
          flags and the operator script. No downstream dispatch is added; production stays disabled.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
          <li>
            Required when using the staging path: <code className="text-xs text-slate-300">NODE_ENV</code> ≠ production,{" "}
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=1</code>,{" "}
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED=1</code>,{" "}
            <code className="text-xs text-slate-300">FI_INTELLIGENCE_STAGING_ALLOWED_EVENT=hairaudit.audit.completed</code>
          </li>
          <li>
            Allowed event for staging activation:{" "}
            {stagingAllowedEvents.map((e) => (
              <code key={e} className="mr-2 text-xs text-slate-300">
                {e}
              </code>
            ))}
          </li>
          <li>
            Rollback: unset staging activation, turn off governed replay and internal bus queue per{" "}
            <code className="text-xs text-slate-300">docs/stage17-staging-activation-path.md</code>, inspect replay run + logs, restart if you
            need to clear the process-local queue.
          </li>
          <li>
            Stage 18 operator rehearsal (dry-run → rollback):{" "}
            <code className="text-xs text-slate-300">docs/stage18-staging-replay-validation-runbook.md</code> —{" "}
            <strong className="text-slate-200">No production activation</strong>.
          </li>
        </ul>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
{`pnpm run replay:intelligence-event-logs -- --staging-activate-run <approved-run-id> --json`}
        </pre>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Read-only template dry-run</h2>
        <p className="mt-2 text-slate-400">
          Example governed-safe filter pair for documentation (does not create a run row):{" "}
          <code className="text-xs text-slate-300">hairaudit.audit.completed</code> +{" "}
          <code className="text-xs text-slate-300">internal_debug</code> — candidates loaded:{" "}
          <strong className="text-slate-200">{templateDryRun.summary.candidates_loaded}</strong>
          {templateDryRun.load_error ? (
            <span className="text-red-400"> — error: {templateDryRun.load_error}</span>
          ) : null}
        </p>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator CLI (JSON)</h2>
        <p className="mt-2 text-slate-400">
          Write actions use the same service-role script as Stage 14. Governed <strong className="text-slate-200">execute</strong>{" "}
          requires <code className="text-xs text-slate-300">FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=1</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
{`pnpm run replay:intelligence-event-logs -- --create-run --mode dry_run --event-name hairaudit.audit.completed --limit 10 --json

pnpm run replay:intelligence-event-logs -- --submit-for-approval <run-id> --json
pnpm run replay:intelligence-event-logs -- --approve-run <run-id> --json
pnpm run replay:intelligence-event-logs -- --execute-run <run-id> --json

# enqueue_shadow planning requires allow-listed event_name + explicit non-operational privacy filter, e.g.:
pnpm run replay:intelligence-event-logs -- --create-run --mode enqueue_shadow \\
  --event-name hairaudit.audit.completed --privacy-level internal_debug --limit 5 --json`}
        </pre>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 text-sm text-slate-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent replay runs</h2>
        {runs.error ? (
          <p className="mt-2 text-red-400">
            Could not load runs: {runs.error}
            <span className="mt-1 block text-xs text-slate-500">
              If the table is missing, apply migration <code className="text-slate-400">20260818120001_fi_intelligence_replay_runs</code>.
            </span>
          </p>
        ) : runs.rows.length === 0 ? (
          <p className="mt-2 text-slate-500">No replay runs yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Cand / OK / Fail</th>
                  <th className="px-3 py-2">Warn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {runs.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                      {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19)}Z
                    </td>
                    <td className="px-3 py-2 text-xs">{r.approval_status}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-200">{r.replay_mode}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.event_name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {r.candidate_count} / {r.processed_count} / {r.failed_count}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.warning_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
