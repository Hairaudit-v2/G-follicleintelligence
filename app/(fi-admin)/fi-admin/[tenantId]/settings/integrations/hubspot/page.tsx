import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HubspotCrmImportCentre } from "@/src/components/fi-admin/settings/HubspotCrmImportCentre";
import { HubSpotConnectorPanel } from "@/src/components/onboarding-os/HubSpotConnectorPanel";
import { ImportReviewPanel } from "@/src/components/onboarding-os/ImportReviewPanel";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { loadHubspotImportBatch } from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadLeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";
import { loadHubspotAuditEvidence, loadHubspotConnectorSnapshot } from "@/src/lib/onboarding-os/hubspotConnector.server";
import { loadHubspotIntegrationForTenant } from "@/src/lib/onboarding-os/hubspotImport.server";
import { canMutateHubspotWorkspace } from "@/src/lib/onboarding-os/hubspotWorkspaceAccess.server";
import {
  hubspotTabsForSession,
  hubspotWorkspaceHref,
  isHubspotTabAllowedForSession,
  resolveHubspotWorkspaceTab,
} from "@/src/lib/onboarding-os/hubspotWorkspaceRoutes";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { isUuid } from "@/src/lib/validation/uuid";

export const dynamic = "force-dynamic";
export const metadata = { title: "HubSpot management", robots: { index: false, follow: false } };

const LABELS = {
  overview: "Overview", "backup-sync": "Backup & Sync", "import-review": "Import Review",
  "activity-webhooks": "Activity & Webhooks", configuration: "Configuration", "audit-history": "Audit & History",
} as const;

const dt = (value: string | null) => value ? new Date(value).toLocaleString() : "No successful run recorded";

export default async function HubspotWorkspacePage({ params, searchParams }: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ tab?: string; batchId?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = await searchParams;
  if (!tenantId?.trim()) notFound();
  await assertFiTenantPortalAccess(tenantId);
  await assertCrmTenantReadAllowed({ tenantId, request: undefined });

  const canManage = await canViewTenantConfigurationHub(tenantId);
  const tab = resolveHubspotWorkspaceTab(sp.tab);
  if (!isHubspotTabAllowedForSession(tab, canManage)) notFound();

  const canMutate = canManage ? await canMutateHubspotWorkspace(tenantId) : false;
  const visibleTabs = hubspotTabsForSession(canManage);

  const integration = await loadHubspotIntegrationForTenant(tenantId);
  if (!integration.ok || !integration.data) {
    if (!canManage) notFound();
    return <div className="space-y-4"><h1 className="text-2xl font-semibold text-slate-50">HubSpot management</h1><p className="text-amber-300">No HubSpot connector is configured for this tenant.</p><Link className="text-cyan-300" href={`/fi-admin/${tenantId}/configuration`}>Configure HubSpot</Link></div>;
  }
  const { integrationId, label } = integration.data;
  const [snapshotResult, queue] = await Promise.all([
    loadHubspotConnectorSnapshot(integrationId, tenantId),
    loadLeadFlowQueueHealth({ tenantId }),
  ]);
  if (!snapshotResult.ok) notFound();
  const snapshot = snapshotResult.snapshot;
  const auditEvidence = tab === "audit-history" ? await loadHubspotAuditEvidence(integrationId, tenantId) : null;
  const status = {
    ...snapshot.workspaceStatus,
    webhook: {
      status: queue.counts.failed > 0 || queue.counts.retrying > 0 ? "degraded" as const : "healthy" as const,
      pending: queue.counts.pending,
      retrying: queue.counts.retrying,
      failed: queue.counts.failed,
      lastWebhookAt: queue.newest_processed_at,
    },
    warnings: [
      ...snapshot.workspaceStatus.warnings,
      ...(queue.counts.failed > 0 || queue.counts.retrying > 0 ? ["Webhook processing is degraded."] : []),
    ],
  };
  const batchId = isUuid(sp.batchId) ? sp.batchId.trim() : null;
  const batch = tab === "import-review" && batchId ? await loadHubspotImportBatch(tenantId, batchId) : { batch: null, stagingPreview: [], stagingTotal: 0 };

  return <div className="space-y-5">
    <header><p className="text-xs uppercase tracking-wide text-slate-500">Settings / Integrations / HubSpot</p><h1 className="mt-2 text-2xl font-semibold text-slate-50">HubSpot management</h1><p className="mt-1 text-sm text-slate-400">Canonical FI OS workspace for {label}. Records remain staged until an operator explicitly imports them.</p></header>
    <nav aria-label="HubSpot workspace tabs" className="flex flex-wrap gap-2">{visibleTabs.map((item) => <Link key={item} href={hubspotWorkspaceHref(tenantId, item)} className={`rounded px-3 py-2 text-sm ${tab === item ? "bg-cyan-500/20 text-cyan-200" : "bg-slate-900 text-slate-400"}`}>{LABELS[item]}</Link>)}</nav>

    {tab === "overview" ? <section className="space-y-4">
      <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">Staged only — Overview cannot approve, reject, promote, import, or run a backup.</div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Connected portal" value={label} detail={`Credentials ${status.credential.status}`} />
        <Card title="Primary backup" value={`${status.primary.counts.contacts.toLocaleString()} contacts · ${status.primary.counts.deals.toLocaleString()} deals`} detail={`Latest success: ${dt(status.primary.completedAt)}`} />
        <Card title="Secondary backup" value={Object.entries(status.secondary.counts).map(([k,v]) => `${k} ${v.total.toLocaleString()}`).join(" · ")} detail={`Latest success: ${dt(status.secondary.completedAt)}`} />
        <Card title="Webhook queue" value={`${status.webhook.pending} pending · ${status.webhook.retrying} retrying · ${status.webhook.failed} failed`} detail={`Last processed: ${dt(status.webhook.lastWebhookAt)}`} />
        <Card title="Import review" value={`${status.importReview.staged} staged · ${status.importReview.approved} approved`} detail="Human review required before promotion" />
        <Card title="Outstanding warnings" value={status.warnings.length ? status.warnings.join(" ") : "None"} detail="Statuses are evaluated independently" />
      </div>
      <div className="flex flex-wrap gap-3"><Link className="text-cyan-300" href={hubspotWorkspaceHref(tenantId,"backup-sync")}>Manage backups →</Link><Link className="text-cyan-300" href={hubspotWorkspaceHref(tenantId,"import-review")}>Review staged records →</Link><Link className="text-cyan-300" href={hubspotWorkspaceHref(tenantId,"activity-webhooks")}>Inspect webhook health →</Link></div>
    </section> : null}

    {tab === "backup-sync" ? <section className="space-y-4"><div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">Staged-only backup evidence. Backups and imports are separate operations; no promotion occurs here.</div><div className="grid gap-3 lg:grid-cols-2"><BackupCard title="Primary backup" status={status.primary.status} startedAt={snapshot.recentSyncRuns.find((run) => !String(run.detail.milestone ?? "").toUpperCase().includes("SECONDARY"))?.startedAt ?? null} completedAt={status.primary.completedAt} lines={[`Contacts: ${status.primary.counts.contacts.toLocaleString()} total`, `Deals: ${status.primary.counts.deals.toLocaleString()}`, "Checkpoint: latest completed primary run", `Reconciliation: ${status.primary.warning ?? "completed"}`]} /><BackupCard title="Secondary backup" status={status.secondary.status} startedAt={snapshot.recentSyncRuns.find((run) => String(run.detail.milestone ?? "").toUpperCase().includes("SECONDARY"))?.startedAt ?? null} completedAt={status.secondary.completedAt} lines={Object.entries(status.secondary.counts).map(([kind, count]) => `${kind}: ${count.total.toLocaleString()} total (${count.current.toLocaleString()} active, ${count.archived.toLocaleString()} archived)`).concat(["Checkpoint: latest completed secondary run", `Reconciliation: ${status.secondary.warning ?? "completed"}`])} /></div><HubSpotConnectorPanel tenantId={tenantId} integrationId={integrationId} integrationLabel={label} initialSnapshot={snapshot} section="backup" canMutate={canMutate} /><Link className="text-cyan-300" href={hubspotWorkspaceHref(tenantId,"audit-history")}>View latest backup results →</Link></section> : null}
    {tab === "import-review" ? <div className="space-y-6"><HubSpotConnectorPanel tenantId={tenantId} integrationId={integrationId} integrationLabel={label} initialSnapshot={snapshot} section="review" canMutate={canMutate} /><ImportReviewPanel tenantId={tenantId} integrationId={integrationId} integrationLabel={label} canMutate={canMutate} /><HubspotCrmImportCentre tenantId={tenantId} initialBatch={batch.batch} stagingPreview={batch.stagingPreview} canMutate={canMutate} /></div> : null}
    {tab === "activity-webhooks" ? <section className="grid gap-3 md:grid-cols-2"><Card title="Queue health" value={status.webhook.status} detail={`${status.webhook.pending} pending · ${status.webhook.retrying} retrying · ${status.webhook.failed} failed`} /><Card title="Route & signature" value={process.env.HUBSPOT_CLIENT_SECRET?.trim() ? "Signature verification configured" : "Signature verification not configured"} detail={`Last webhook: ${dt(status.webhook.lastWebhookAt)}`} /></section> : null}
    {tab === "configuration" ? <section className="space-y-4"><Card title="Connected portal" value={label} detail="HubSpot portal identity" /><Card title="Credential storage" value={status.credential.verified ? "Stored and verified" : "Verification required"} detail="Credential values are never rendered" /><Card title="Authentication" value="Private App / server-side credential" detail="Scope and verification evidence is shown below" /><div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"><p className="font-medium text-slate-100">Verification evidence</p><p className="mt-2">Live API verification: {snapshot.secondaryEvidence.liveCapabilityProbe?.outcome ?? "No live verification recorded"}</p><p>Test/configuration verification: {snapshot.secondaryEvidence.configurationVerification?.outcome ?? "No test verification recorded"}</p><p className="mt-2 text-xs text-slate-400">Required and granted scopes are retained in connector evidence. Credential values are never rendered.</p></div><HubSpotConnectorPanel tenantId={tenantId} integrationId={integrationId} integrationLabel={label} initialSnapshot={snapshot} section="configuration" canMutate={canMutate} /><Link className="text-cyan-300" href={`/fi-admin/${tenantId}/configuration`}>Reconnect, revoke, and pipeline configuration →</Link></section> : null}
    {tab === "audit-history" ? <section className="space-y-5"><AuditSection title="Primary backup runs" rows={snapshot.recentSyncRuns.filter((run) => !String(run.detail.milestone ?? "").toUpperCase().includes("SECONDARY")).map((run) => `${run.status} · ${dt(run.completedAt ?? run.startedAt)} · contacts ${run.contactsDiscovered.toLocaleString()} · deals ${run.dealsDiscovered.toLocaleString()}`)} /><AuditSection title="Secondary backup runs" rows={snapshot.recentSyncRuns.filter((run) => String(run.detail.milestone ?? "").toUpperCase().includes("SECONDARY")).map((run) => `${run.status} · ${dt(run.completedAt ?? run.startedAt)} · secondary object counts recorded`)} /><AuditSection title="Credential verification events" rows={auditEvidence?.verifications.map((event) => `${event.type} · ${event.outcome} · ${dt(event.occurredAt)}`) ?? []} /><AuditSection title="Webhook and queue events" rows={[`${status.webhook.status} · ${status.webhook.pending} pending · ${status.webhook.retrying} retrying · ${status.webhook.failed} failed`]} /><AuditSection title="Import/review actions" rows={auditEvidence?.audit.filter((event) => /approve|reject|import/i.test(event.action)).map((event) => `${event.action} · ${event.operator} · ${dt(event.occurredAt)}`) ?? []} /><AuditSection title="Configuration or scope changes" rows={auditEvidence?.audit.filter((event) => /scope|config|credential/i.test(event.action)).map((event) => `${event.action} · ${event.operator} · ${dt(event.occurredAt)}`) ?? []} /></section> : null}
  </div>;
}

function Card({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><h2 className="text-xs uppercase tracking-wide text-slate-500">{title}</h2><p className="mt-2 text-sm font-medium text-slate-100">{value}</p><p className="mt-2 text-xs text-slate-400">{detail}</p></article>;
}

function BackupCard({ title, status, startedAt, completedAt, lines }: { title: string; status: string | null; startedAt: string | null; completedAt: string | null; lines: string[] }) {
  return <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"><h2 className="font-medium text-slate-100">{title}</h2><p className="mt-1">Status: {status ?? "No run recorded"}</p><p>Started: {dt(startedAt)}</p><p>Completed: {dt(completedAt)}</p><ul className="mt-3 space-y-1 text-xs text-slate-400">{lines.map((line) => <li key={line}>{line}</li>)}</ul></article>;
}

function AuditSection({ title, rows }: { title: string; rows: string[] }) { return <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><h2 className="font-medium text-slate-100">{title}</h2>{rows.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No privacy-safe events recorded.</p>}</article>; }
