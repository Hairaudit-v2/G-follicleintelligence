"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  cancelHubspotImportAction,
  importHubspotContactAction,
  importHubspotDealAction,
  loadImportReviewQueueAction,
  mergeHubspotContactAction,
} from "@/lib/actions/fi-onboarding-os-import-actions";
import type { ImportReviewItem } from "@/src/lib/onboarding-os/hubspotImport.server";
import { HUBSPOT_LEAD_TYPE_LABELS } from "@/src/lib/onboarding-os/hubspotConnectorTypes";
import type { FiLeadImportPreview, FiOpportunityImportPreview } from "@/src/lib/onboarding-os/importPreviewEngine";

type Props = {
  tenantId: string;
  integrationId?: string | null;
  integrationLabel?: string;
};

function ConfidenceBadge({ score, blocking }: { score: number; blocking: boolean }) {
  const tone = blocking ? "bg-red-500/15 text-red-300" : score >= 70 ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {blocking ? "Blocking" : "Confidence"} {score}%
    </span>
  );
}

function PreviewBlock({ preview, kind }: { preview: FiLeadImportPreview | FiOpportunityImportPreview; kind: "contact" | "deal" }) {
  if (kind === "contact") {
    const p = preview as FiLeadImportPreview;
    return (
      <dl className="grid gap-1 text-xs text-slate-300">
        <div><dt className="text-slate-500">Summary</dt><dd>{p.summary}</dd></div>
        <div><dt className="text-slate-500">Classification</dt><dd>{p.classification}</dd></div>
        <div><dt className="text-slate-500">Lead type</dt><dd>{HUBSPOT_LEAD_TYPE_LABELS[p.normalizedLeadType]}</dd></div>
        <div><dt className="text-slate-500">Pipeline slug</dt><dd>{p.mappedPipelineSlug ?? "—"}</dd></div>
        <div><dt className="text-slate-500">Create patient</dt><dd>{p.createPatient ? "Yes" : "No"}</dd></div>
      </dl>
    );
  }
  const d = preview as FiOpportunityImportPreview;
  return (
    <dl className="grid gap-1 text-xs text-slate-300">
      <div><dt className="text-slate-500">Deal</dt><dd>{d.dealName ?? d.summary}</dd></div>
      <div><dt className="text-slate-500">Stage</dt><dd>{d.dealStage ?? "—"}</dd></div>
      <div><dt className="text-slate-500">Pipeline</dt><dd>{d.pipelineName ?? "—"}</dd></div>
      <div><dt className="text-slate-500">Linked contact</dt><dd>{d.linkToContactId ?? "—"}</dd></div>
    </dl>
  );
}

function ReviewCard({
  item,
  tenantId,
  integrationId,
  pending,
  onDone,
}: {
  item: ImportReviewItem;
  tenantId: string;
  integrationId: string;
  pending: boolean;
  onDone: () => void;
}) {
  const staging = item.staging;
  const isContact = item.kind === "contact";
  const stagingId = staging.id;
  const externalLabel = isContact
    ? (staging as { hubspotContactId: string }).hubspotContactId
    : (staging as { hubspotDealId: string }).hubspotDealId;

  const topMatch = item.duplicateCheck.matches[0];

  const handleImport = () => {
    const action = isContact
      ? importHubspotContactAction(tenantId, integrationId, stagingId)
      : importHubspotDealAction(tenantId, integrationId, stagingId);
    void action.then((r) => {
      if (!r.ok) alert(r.error);
      else onDone();
    });
  };

  const handleCancel = () => {
    void cancelHubspotImportAction(tenantId, integrationId, item.kind, stagingId).then((r) => {
      if (!r.ok) alert(r.error);
      else onDone();
    });
  };

  const handleMerge = () => {
    if (!topMatch || topMatch.entityType !== "person") {
      alert("No mergeable person match found.");
      return;
    }
    void mergeHubspotContactAction(tenantId, integrationId, stagingId, topMatch.entityId).then((r) => {
      if (!r.ok) alert(r.error);
      else onDone();
    });
  };

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">
            {isContact ? "HubSpot contact" : "HubSpot deal"} · {externalLabel}
          </p>
          <p className="text-xs text-slate-400">
            {item.preview.email ?? "No email"} · {item.preview.phone ?? "No phone"}
          </p>
        </div>
        <ConfidenceBadge score={item.duplicateCheck.confidenceScore} blocking={item.duplicateCheck.hasBlockingMatch} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Staged record</p>
          <pre className="max-h-32 overflow-auto rounded bg-slate-950/60 p-2 text-xs text-slate-400">
            {JSON.stringify(staging.rawPayload, null, 2).slice(0, 800)}
          </pre>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">FI import preview</p>
          <PreviewBlock preview={item.preview} kind={item.kind} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Duplicate check</p>
        <p className="text-sm text-slate-300">{item.duplicateCheck.summary}</p>
        {item.duplicateCheck.matches.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {item.duplicateCheck.matches.slice(0, 5).map((m) => (
              <li key={`${m.entityType}-${m.entityId}-${m.rule}`}>
                {m.label} — {m.entityType} {m.entityId.slice(0, 8)}… ({m.confidence}%)
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded border border-slate-700/40 bg-slate-950/30 px-3 py-2">
        <p className="text-xs text-slate-500">Proposed FI action</p>
        <p className="text-sm font-medium text-cyan-300">{item.proposedAction}</p>
        <p className="mt-1 text-xs text-slate-500">Read-only HubSpot — FI is destination. No overwrite of existing records.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || item.proposedAction === "blocked"}
          onClick={handleImport}
          className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Import Now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleCancel}
          className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancel Import
        </button>
        {isContact && topMatch?.entityType === "person" && (
          <button
            type="button"
            disabled={pending}
            onClick={handleMerge}
            className="rounded border border-amber-500/40 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Merge Existing
          </button>
        )}
      </div>
    </div>
  );
}

export function ImportReviewPanel({ tenantId, integrationId: initialIntegrationId, integrationLabel: initialLabel }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ImportReviewItem[]>([]);
  const [integrationId, setIntegrationId] = useState(initialIntegrationId ?? "");
  const [integrationLabel, setIntegrationLabel] = useState(initialLabel ?? "HubSpot");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await loadImportReviewQueueAction(tenantId, integrationId || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setItems(res.items ?? []);
      if (res.integrationId) setIntegrationId(res.integrationId);
      if (res.integrationLabel) setIntegrationLabel(res.integrationLabel);
    });
  }, [tenantId, integrationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onDone = () => {
    refresh();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Staged import review</h2>
          <p className="text-sm text-slate-400">
            Approved {integrationLabel} records awaiting explicit import into FI. HubSpot remains read-only.
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/configuration`}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          Back to configuration
        </Link>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {pending && items.length === 0 && <p className="text-sm text-slate-400">Loading approved records…</p>}

      {!pending && items.length === 0 && !error && (
        <p className="text-sm text-slate-400">No approved staging records ready for import.</p>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <ReviewCard
            key={`${item.kind}-${item.staging.id}`}
            item={item}
            tenantId={tenantId}
            integrationId={integrationId}
            pending={pending}
            onDone={onDone}
          />
        ))}
      </div>
    </div>
  );
}
