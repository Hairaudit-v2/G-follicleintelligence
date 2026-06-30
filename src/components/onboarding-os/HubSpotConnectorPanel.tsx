"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  approveHubspotDealAction,
  approveHubspotLeadAction,
  loadHubspotConnectorSnapshotAction,
  rejectHubspotDealAction,
  rejectHubspotLeadAction,
  runHubspotSyncAction,
} from "@/lib/actions/fi-onboarding-os-hubspot-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  HUBSPOT_IMPORT_STATUS_BADGES,
  HUBSPOT_LEAD_TYPE_LABELS,
} from "@/src/lib/onboarding-os/hubspotConnectorTypes";
import type {
  HubspotConnectorSnapshot,
  HubspotStagingContact,
  HubspotStagingDeal,
} from "@/src/lib/onboarding-os/hubspotConnectorTypes";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

const HEALTH_BAND_CLASSES: Record<string, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  unhealthy: "text-red-400",
  unknown: "text-slate-400",
};

type Props = {
  tenantId: string;
  integrationId: string;
  integrationLabel?: string;
  sessionId?: string | null;
  initialSnapshot?: HubspotConnectorSnapshot | null;
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

function ContactReviewCard({
  tenantId,
  contact,
  pending,
  onApprove,
  onReject,
}: {
  tenantId: string;
  contact: HubspotStagingContact;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const badge = HUBSPOT_IMPORT_STATUS_BADGES[contact.importStatus];
  const typeLabel = HUBSPOT_LEAD_TYPE_LABELS[contact.normalizedLeadType];
  const canReview = contact.importStatus === "staged" || contact.importStatus === "reviewed";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{contact.email ?? "No email"}</p>
          <p className="text-xs text-slate-400">{contact.phone ?? "No phone"}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {contact.duplicateRisk ? (
            <StatusBadge label="Duplicate risk" tone="warning" />
          ) : null}
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>
      </div>

      <div className="grid gap-1 text-xs text-slate-400">
        <p>
          Suggested type: <span className="text-cyan-300">{typeLabel}</span>
        </p>
        {contact.leadSource ? <p>Lead source: {contact.leadSource}</p> : null}
        <p className="text-slate-500">HubSpot contact ID: {contact.hubspotContactId}</p>
      </div>

      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onApprove}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-500">
            {contact.importStatus === "approved"
              ? "Approved — ready for staged import review."
              : contact.importStatus === "rejected"
                ? "Rejected — will not be imported."
                : contact.importStatus === "imported"
                  ? "Imported into FI."
                  : "Review complete."}
          </p>
          {contact.importStatus === "approved" ? (
            <Link
              href={`/fi-admin/${tenantId}/onboarding-os/import-review`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Open import review →
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function DealReviewCard({
  tenantId,
  deal,
  pending,
  onApprove,
  onReject,
}: {
  tenantId: string;
  deal: HubspotStagingDeal;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const badge = HUBSPOT_IMPORT_STATUS_BADGES[deal.importStatus];
  const typeLabel = HUBSPOT_LEAD_TYPE_LABELS[deal.normalizedLeadType];
  const canReview = deal.importStatus === "staged" || deal.importStatus === "reviewed";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{deal.pipelineName ?? "Unknown pipeline"}</p>
          <p className="text-xs text-slate-400">Stage: {deal.dealStage ?? "Unknown"}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {deal.duplicateRisk ? (
            <StatusBadge label="Duplicate risk" tone="warning" />
          ) : null}
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>
      </div>

      <div className="grid gap-1 text-xs text-slate-400">
        <p>
          Suggested type: <span className="text-cyan-300">{typeLabel}</span>
        </p>
        {deal.email ? <p>Email: {deal.email}</p> : null}
        <p className="text-slate-500">HubSpot deal ID: {deal.hubspotDealId}</p>
      </div>

      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onApprove}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-500">
            {deal.importStatus === "approved"
              ? "Approved — ready for staged import review."
              : deal.importStatus === "rejected"
                ? "Rejected — will not be imported."
                : deal.importStatus === "imported"
                  ? "Imported into FI."
                  : "Review complete."}
          </p>
          {deal.importStatus === "approved" ? (
            <Link
              href={`/fi-admin/${tenantId}/onboarding-os/import-review`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Open import review →
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

export function HubSpotConnectorPanel({
  tenantId,
  integrationId,
  integrationLabel = "HubSpot",
  sessionId,
  initialSnapshot,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState<HubspotConnectorSnapshot | null>(initialSnapshot ?? null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [queueFilter, setQueueFilter] = useState<"staged" | "all">("staged");
  const [activeTab, setActiveTab] = useState<"contacts" | "deals">("contacts");

  useEffect(() => {
    if (initialSnapshot) return;
    let cancelled = false;
    void loadHubspotConnectorSnapshotAction(tenantId, integrationId).then((res) => {
      if (cancelled || !res.ok || !res.snapshot) return;
      setSnapshot(res.snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSnapshot, tenantId, integrationId]);

  const health = snapshot?.syncHealth;
  const latestRun = snapshot?.latestSyncRun;

  const contactQueue =
    queueFilter === "staged"
      ? (snapshot?.contactQueue ?? []).filter((c) => c.importStatus === "staged")
      : (snapshot?.contactQueue ?? []);

  const dealQueue =
    queueFilter === "staged"
      ? (snapshot?.dealQueue ?? []).filter((d) => d.importStatus === "staged")
      : (snapshot?.dealQueue ?? []);

  function refreshSnapshot(resSnapshot?: HubspotConnectorSnapshot) {
    if (resSnapshot) setSnapshot(resSnapshot);
  }

  function runSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await runHubspotSyncAction(tenantId, integrationId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      const run = res.snapshot?.latestSyncRun;
      setMessage({
        kind: "ok",
        text: `Sync complete — ${run?.contactsStaged ?? 0} contact(s) and ${run?.dealsStaged ?? 0} deal(s) staged for review. No FI leads created.`,
      });
      router.refresh();
    });
  }

  function approveContact(contactId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await approveHubspotLeadAction(tenantId, integrationId, contactId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Contact approved — remains in staging only; no FI lead created." });
      router.refresh();
    });
  }

  function rejectContact(contactId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await rejectHubspotLeadAction(tenantId, integrationId, contactId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Contact rejected." });
      router.refresh();
    });
  }

  function approveDeal(dealId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await approveHubspotDealAction(tenantId, integrationId, dealId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Deal approved — remains in staging only; no FI opportunity created." });
      router.refresh();
    });
  }

  function rejectDeal(dealId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await rejectHubspotDealAction(tenantId, integrationId, dealId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Deal rejected." });
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5 space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase F4</p>
        <h2 className="text-lg font-semibold text-slate-50">{integrationLabel} — Read-only sync</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Pull HubSpot contacts and deals into staging for human review. Read-only access — never writes back to HubSpot
          and never creates FI leads automatically.
        </p>
      </div>

      <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
        Staging only — all records require manual approval. No automatic lead creation or duplicate merging.
      </div>

      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Last sync</p>
          <p className="mt-1 text-sm font-medium text-slate-100">
            {health?.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString() : "Never"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Contacts pulled</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{latestRun?.contactsDiscovered ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Deals pulled</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{latestRun?.dealsDiscovered ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Sync health</p>
          <p className={`mt-1 text-sm font-medium ${HEALTH_BAND_CLASSES[health?.healthBand ?? "unknown"]}`}>
            {health?.healthScore ?? 0}% · {health?.healthBand ?? "unknown"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Duplicate risks</p>
          <p className="mt-1 text-sm font-medium text-amber-300">{health?.duplicateRiskCount ?? 0}</p>
        </div>
      </div>

      {health?.summary ? <p className="text-xs text-slate-500">{health.summary}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={runSync}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Sync now
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-300">Review queue</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={`rounded px-2 py-1 ${activeTab === "contacts" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Contacts ({health?.contactsPendingReview ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("deals")}
              className={`rounded px-2 py-1 ${activeTab === "deals" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Deals ({health?.dealsPendingReview ?? 0})
            </button>
            <span className="text-slate-400">|</span>
            <button
              type="button"
              onClick={() => setQueueFilter("staged")}
              className={`rounded px-2 py-1 ${queueFilter === "staged" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Pending review
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("all")}
              className={`rounded px-2 py-1 ${queueFilter === "all" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              All staged
            </button>
          </div>
        </div>

        {activeTab === "contacts" ? (
          contactQueue.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {contactQueue.map((contact) => (
                <ContactReviewCard
                  key={contact.id}
                  tenantId={tenantId}
                  contact={contact}
                  pending={pending}
                  onApprove={() => approveContact(contact.id)}
                  onReject={() => rejectContact(contact.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No contacts in staging queue. Run a manual sync after verifying HubSpot credentials.
            </p>
          )
        ) : dealQueue.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {dealQueue.map((deal) => (
              <DealReviewCard
                key={deal.id}
                tenantId={tenantId}
                deal={deal}
                pending={pending}
                onApprove={() => approveDeal(deal.id)}
                onReject={() => rejectDeal(deal.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No deals in staging queue. Run a manual sync after verifying HubSpot credentials.
          </p>
        )}
      </div>
    </section>
  );
}
