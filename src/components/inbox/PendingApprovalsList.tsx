"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import {
  cancelHubspotImportAction,
  importHubspotContactAction,
  importHubspotDealAction,
  loadImportReviewQueueAction,
  mergeHubspotContactAction,
} from "@/lib/actions/fi-onboarding-os-import-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ImportReviewItem } from "@/src/lib/onboarding-os/hubspotImport.server";
import {
  HUBSPOT_LEAD_TYPE_LABELS,
  type HubspotStagingContact,
  type HubspotStagingDeal,
} from "@/src/lib/onboarding-os/hubspotConnectorTypes";
import type {
  FiLeadImportPreview,
  FiOpportunityImportPreview,
} from "@/src/lib/onboarding-os/importPreviewEngine";

// ---------- Helpers ----------

const HUBSPOT_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  CONNECTED: "Connected",
  UNQUALIFIED: "Unqualified",
  OPEN_DEAL: "Open Deal",
  "Website Appointment Button": "Website Appointment",
  lead: "Lead",
  customer: "Customer",
  opportunity: "Opportunity",
  subscriber: "Subscriber",
  salesqualifiedlead: "Sales qualified lead",
  marketingqualifiedlead: "Marketing qualified lead",
};

function getReadableStatus(source: string | null | undefined): string {
  if (!source?.trim()) return "Unknown source";
  const raw = source.trim();
  return HUBSPOT_STATUS_LABELS[raw] || HUBSPOT_STATUS_LABELS[raw.toUpperCase()] || raw.replace(/_/g, " ");
}

function getDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  dealName?: string | null;
  summary?: string | null;
}): string {
  if (input.displayName?.trim()) return input.displayName.trim();
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (input.dealName?.trim()) return input.dealName.trim();
  if (input.summary?.trim()) return input.summary.trim();
  return input.email?.trim() || "Unknown contact";
}

function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const t = typeof date === "string" ? Date.parse(date) : date.getTime();
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 60) return rtf.format(diffDay, "day");
  const diffMo = Math.round(diffDay / 30);
  return rtf.format(diffMo, "month");
}

function cardFields(item: ImportReviewItem): {
  displayName: string;
  email: string | null;
  phone: string | null;
  statusLabel: string;
  suggestedType: string | null;
  hubspotId: string;
  createdAt: string;
  kindLabel: string;
} {
  const isContact = item.kind === "contact";
  if (isContact) {
    const p = item.preview as FiLeadImportPreview;
    const staging = item.staging as HubspotStagingContact;
    const email = p.email ?? staging.email ?? null;
    const displayName = getDisplayName({
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName,
      email,
    });
    const typeLabel = HUBSPOT_LEAD_TYPE_LABELS[p.normalizedLeadType] ?? null;
    return {
      displayName,
      email,
      phone: p.phone ?? staging.phone ?? null,
      statusLabel: getReadableStatus(p.leadSource ?? p.lifecycleStage ?? staging.leadSource),
      suggestedType: typeLabel && typeLabel !== "Unknown" ? typeLabel : null,
      hubspotId: staging.hubspotContactId,
      createdAt: staging.createdAt,
      kindLabel: "Contact",
    };
  }
  const d = item.preview as FiOpportunityImportPreview;
  const staging = item.staging as HubspotStagingDeal;
  const email = d.email ?? staging.email ?? null;
  return {
    displayName: getDisplayName({
      dealName: d.dealName,
      summary: d.summary,
      email,
    }),
    email,
    phone: d.phone ?? staging.phone ?? null,
    statusLabel: getReadableStatus(
      d.dealStage ?? staging.dealStage ?? d.leadSource ?? staging.leadSource
    ),
    suggestedType: d.pipelineName?.trim() || staging.pipelineName?.trim() || null,
    hubspotId: staging.hubspotDealId,
    createdAt: staging.createdAt,
    kindLabel: "Deal",
  };
}

// ---------- Card ----------

function ApprovalCard({
  item,
  tenantId,
  integrationId,
  pending,
  canMutate,
  onDone,
}: {
  item: ImportReviewItem;
  tenantId: string;
  integrationId: string;
  pending: boolean;
  canMutate: boolean;
  onDone: () => void;
}) {
  const fields = cardFields(item);
  const isContact = item.kind === "contact";
  const stagingId = item.staging.id;
  const topMatch = item.duplicateCheck.matches[0];
  const age = relativeTime(fields.createdAt);
  const blocked = item.proposedAction === "blocked";

  const handleApprove = () => {
    const action = isContact
      ? importHubspotContactAction(tenantId, integrationId, stagingId)
      : importHubspotDealAction(tenantId, integrationId, stagingId);
    void action.then((r) => {
      if (!r.ok) alert(r.error);
      else onDone();
    });
  };

  const handleReject = () => {
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
    void mergeHubspotContactAction(tenantId, integrationId, stagingId, topMatch.entityId).then(
      (r) => {
        if (!r.ok) alert(r.error);
        else onDone();
      }
    );
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-white/[0.14]"
      )}
      data-testid="inbox-approval-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-50">{fields.displayName}</h3>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {fields.kindLabel}
            </span>
          </div>

          <div className="mt-1 space-y-0.5 text-sm text-slate-400">
            {fields.email && fields.displayName !== fields.email ? (
              <p className="truncate">{fields.email}</p>
            ) : null}
            {fields.phone ? <p>{fields.phone}</p> : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant="secondary"
              className="border-white/[0.08] bg-white/[0.06] font-normal text-slate-200"
            >
              {fields.statusLabel}
            </Badge>

            {fields.suggestedType ? (
              <Badge
                variant="outline"
                className="border-white/[0.12] font-normal text-slate-300"
              >
                {fields.suggestedType}
              </Badge>
            ) : null}

            {age ? <span className="text-slate-500">{age}</span> : null}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            HubSpot ID: {fields.hubspotId}
            {item.duplicateCheck.hasBlockingMatch ? (
              <span className="ml-2 text-rose-300">· Possible duplicate</span>
            ) : null}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Proposed: <span className="text-cyan-300/90">{item.proposedAction}</span>
          </p>
        </div>

        <Badge className="shrink-0 border-0 bg-blue-500/15 font-medium text-blue-300 hover:bg-blue-500/15">
          Pending review
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {canMutate ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={handleReject}
              className="gap-1.5 border-white/[0.12] bg-transparent text-slate-200 hover:bg-white/[0.06]"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Reject
            </Button>
            {isContact && topMatch?.entityType === "person" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={handleMerge}
                className="gap-1.5 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10"
              >
                Merge
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending || blocked}
              onClick={handleApprove}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Approve
            </Button>
          </>
        ) : (
          <p className="text-xs text-slate-500">Read-only — import requires operator access.</p>
        )}
      </div>
    </div>
  );
}

// ---------- List ----------

/**
 * Inbox body: leads/contacts (and deals) approved in staging and waiting for explicit
 * import into FI clinic records. Card UI + real HubSpot staged import actions.
 */
export function PendingApprovalsList({
  tenantId,
  canMutate = true,
}: {
  tenantId: string;
  canMutate?: boolean;
}) {
  const tid = tenantId.trim();
  const router = useRouter();
  const hubspotReviewHref = `/fi-admin/${tid}/settings/integrations/hubspot?tab=import-review`;

  const [items, setItems] = useState<ImportReviewItem[]>([]);
  const [integrationId, setIntegrationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const res = await loadImportReviewQueueAction(tid, integrationId || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setItems(res.items ?? []);
      if (res.integrationId) setIntegrationId(res.integrationId);
    });
  }, [tid, integrationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onDone = () => {
    refresh();
    router.refresh();
  };

  return (
    <div className="space-y-4" data-testid="pending-approvals-list">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-[#0F1629]/60 px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-400">
          Records that have been staged and approved for import — they do not enter the clinic
          system until someone imports them here.
        </p>
        <Link
          href={hubspotReviewHref}
          className="shrink-0 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          Full HubSpot import workspace →
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {pending && items.length === 0 ? (
        <p className="text-sm text-slate-400">Loading approved records…</p>
      ) : null}

      {!pending && items.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-white/[0.12] p-12 text-center text-slate-400">
          No leads waiting for approval
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <ApprovalCard
              key={`${item.kind}-${item.staging.id}`}
              item={item}
              tenantId={tid}
              integrationId={integrationId}
              pending={pending}
              canMutate={canMutate}
              onDone={onDone}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
