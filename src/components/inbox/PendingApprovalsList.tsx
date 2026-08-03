"use client";

/**
 * FI OS Inbox — PendingApprovalsList
 * Staged HubSpot leads/contacts waiting for explicit import into the clinic system.
 * Dark medical CRM UI: cards, bulk selection, details sheet.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Check,
  CheckCheck,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Square,
  SquareCheck,
  X,
} from "lucide-react";

import {
  cancelHubspotImportAction,
  importHubspotContactAction,
  importHubspotDealAction,
  loadImportReviewQueueAction,
} from "@/lib/actions/fi-onboarding-os-import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PendingApprovalsListProps = {
  tenantId: string;
  /** When false, hide approve/reject (read-only). Default true. */
  canMutate?: boolean;
};

/** Stable selection key for a queue row. */
export type ApprovalItemKey = string; // `${kind}:${stagingId}`

export type ApprovalCardFields = {
  key: ApprovalItemKey;
  kind: "contact" | "deal";
  kindLabel: string;
  /** Primary line: first + last name, else email. */
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** Readable HubSpot lead_source / status. */
  statusLabel: string;
  /** Suggested FI lead type / pipeline. */
  suggestedType: string | null;
  createdAt: string;
  hubspotId: string;
  /** Free-text enquiry / message if present in HubSpot payload. */
  enquiryMessage: string | null;
  /** Flattened form / property pairs for the details panel. */
  formData: Array<{ key: string; value: string }>;
  proposedAction: string;
  blocked: boolean;
  hasDuplicate: boolean;
};

// ---------------------------------------------------------------------------
// Helpers — labels & name
// ---------------------------------------------------------------------------

/** HubSpot lead_source / lifecycle → clinic-facing labels. */
const HUBSPOT_LEAD_SOURCE_LABELS: Record<string, string> = {
  IN_PROGRESS: "In Progress",
  CONNECTED: "Connected",
  UNQUALIFIED: "Unqualified",
  OPEN_DEAL: "Open Deal",
  "Website Appointment Button": "Website Appointment",
  // Common lifecycle stages
  lead: "Lead",
  customer: "Customer",
  opportunity: "Opportunity",
  subscriber: "Subscriber",
  salesqualifiedlead: "Sales qualified lead",
  marketingqualifiedlead: "Marketing qualified lead",
};

/**
 * Map HubSpot lead_source (or similar) values to readable labels.
 * Exact map first, then underscore → spaces fallback.
 */
export function getReadableLeadSource(source: string | null | undefined): string {
  if (!source?.trim()) return "Unknown source";
  const raw = source.trim();
  if (HUBSPOT_LEAD_SOURCE_LABELS[raw]) return HUBSPOT_LEAD_SOURCE_LABELS[raw];
  const upper = raw.toUpperCase();
  if (HUBSPOT_LEAD_SOURCE_LABELS[upper]) return HUBSPOT_LEAD_SOURCE_LABELS[upper];
  const lower = raw.toLowerCase();
  if (HUBSPOT_LEAD_SOURCE_LABELS[lower]) return HUBSPOT_LEAD_SOURCE_LABELS[lower];
  return raw.replace(/_/g, " ");
}

/** Primary identifier: firstname + lastname, fallback email (then deal name / summary). */
export function getPrimaryDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  dealName?: string | null;
  summary?: string | null;
}): string {
  const composed = [input.firstName, input.lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (composed) return composed;
  if (input.displayName?.trim()) return input.displayName.trim();
  if (input.email?.trim()) return input.email.trim();
  if (input.dealName?.trim()) return input.dealName.trim();
  if (input.summary?.trim()) return input.summary.trim();
  return "Unknown contact";
}

/** Relative time via date-fns (e.g. "2 days ago"). */
export function formatRelativeReceived(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Exact local date/time for the details panel. */
export function formatExactReceived(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "PPpp");
}

function itemKey(item: ImportReviewItem): ApprovalItemKey {
  return `${item.kind}:${item.staging.id}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function stringProp(props: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!props) return null;
  for (const k of keys) {
    const v = props[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

/**
 * Pull HubSpot properties from staging.rawPayload (API contact/deal shape).
 */
function extractHubspotProperties(rawPayload: Record<string, unknown>): Record<string, unknown> {
  const nested = asRecord(rawPayload.properties);
  if (nested) return nested;
  // Some rows store properties at the top level of rawPayload.
  return rawPayload;
}

/** Prefer common enquiry / message fields from HubSpot form payloads. */
function extractEnquiryMessage(props: Record<string, unknown>): string | null {
  return stringProp(
    props,
    "message",
    "enquiry",
    "enquiry_message",
    "notes",
    "hs_content_membership_notes",
    "additional_notes",
    "comments",
    "how_can_we_help",
    "description"
  );
}

/**
 * Key-value pairs for the details panel (skip empty + noisy internal ids).
 */
function extractFormDataPairs(props: Record<string, unknown>): Array<{ key: string; value: string }> {
  const skip = new Set([
    "hs_object_id",
    "hs_all_contact_vids",
    "hs_calculated_phone_number",
    "hs_merged_object_ids",
  ]);
  const out: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(props)) {
    if (skip.has(key)) continue;
    if (value == null) continue;
    const s = String(value).trim();
    if (!s) continue;
    // Avoid dumping huge JSON blobs in the panel.
    if (s.length > 2000) {
      out.push({ key, value: `${s.slice(0, 2000)}…` });
    } else {
      out.push({ key, value: s });
    }
  }
  // Stable order for scanning.
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

/** Map ImportReviewItem → card/panel view model. */
export function toApprovalCardFields(item: ImportReviewItem): ApprovalCardFields {
  const key = itemKey(item);
  const isContact = item.kind === "contact";

  if (isContact) {
    const p = item.preview as FiLeadImportPreview;
    const staging = item.staging as HubspotStagingContact;
    const props = extractHubspotProperties(staging.rawPayload ?? {});
    const email = p.email ?? staging.email ?? stringProp(props, "email") ?? null;
    const firstName = p.firstName ?? stringProp(props, "firstname", "first_name", "firstName");
    const lastName = p.lastName ?? stringProp(props, "lastname", "last_name", "lastName");
    const displayName = getPrimaryDisplayName({
      firstName,
      lastName,
      displayName: p.displayName,
      email,
    });
    const typeLabel = HUBSPOT_LEAD_TYPE_LABELS[p.normalizedLeadType] ?? null;
    return {
      key,
      kind: "contact",
      kindLabel: "Contact",
      displayName,
      firstName,
      lastName,
      email,
      phone: p.phone ?? staging.phone ?? stringProp(props, "phone", "mobilephone") ?? null,
      statusLabel: getReadableLeadSource(
        p.leadSource ?? p.lifecycleStage ?? staging.leadSource ?? stringProp(props, "hs_lead_status", "lifecyclestage")
      ),
      suggestedType: typeLabel && typeLabel !== "Unknown" ? typeLabel : null,
      createdAt: staging.createdAt,
      hubspotId: staging.hubspotContactId,
      enquiryMessage: extractEnquiryMessage(props),
      formData: extractFormDataPairs(props),
      proposedAction: item.proposedAction,
      blocked: item.proposedAction === "blocked",
      hasDuplicate: Boolean(item.duplicateCheck.hasBlockingMatch),
    };
  }

  const d = item.preview as FiOpportunityImportPreview;
  const staging = item.staging as HubspotStagingDeal;
  const props = extractHubspotProperties(staging.rawPayload ?? {});
  const email = d.email ?? staging.email ?? stringProp(props, "email") ?? null;
  return {
    key,
    kind: "deal",
    kindLabel: "Deal",
    displayName: getPrimaryDisplayName({
      dealName: d.dealName,
      summary: d.summary,
      email,
    }),
    firstName: null,
    lastName: null,
    email,
    phone: d.phone ?? staging.phone ?? stringProp(props, "phone") ?? null,
    statusLabel: getReadableLeadSource(
      d.dealStage ?? staging.dealStage ?? d.leadSource ?? staging.leadSource
    ),
    suggestedType: d.pipelineName?.trim() || staging.pipelineName?.trim() || null,
    createdAt: staging.createdAt,
    hubspotId: staging.hubspotDealId,
    enquiryMessage: extractEnquiryMessage(props),
    formData: extractFormDataPairs(props),
    proposedAction: item.proposedAction,
    blocked: item.proposedAction === "blocked",
    hasDuplicate: Boolean(item.duplicateCheck.hasBlockingMatch),
  };
}

// ---------------------------------------------------------------------------
// ApprovalCard
// ---------------------------------------------------------------------------

function ApprovalCard({
  item,
  fields,
  selected,
  canMutate,
  busy,
  onToggleSelect,
  onOpenDetails,
  onApprove,
  onReject,
}: {
  item: ImportReviewItem;
  fields: ApprovalCardFields;
  selected: boolean;
  canMutate: boolean;
  busy: boolean;
  onToggleSelect: (key: ApprovalItemKey, next: boolean) => void;
  onOpenDetails: (item: ImportReviewItem) => void;
  onApprove: (item: ImportReviewItem) => void;
  onReject: (item: ImportReviewItem) => void;
}) {
  const relative = formatRelativeReceived(fields.createdAt);

  return (
    <article
      className={cn(
        "group relative rounded-xl border bg-[#0F1629]/85 p-4 shadow-lg shadow-black/30 backdrop-blur-md transition",
        selected
          ? "border-cyan-400/45 ring-1 ring-cyan-400/25"
          : "border-white/[0.08] hover:border-white/[0.14]"
      )}
      data-testid="inbox-approval-card"
      data-selected={selected ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        {/* Selection */}
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            disabled={busy || !canMutate}
            onCheckedChange={(v) => onToggleSelect(fields.key, v === true)}
            aria-label={`Select ${fields.displayName}`}
            data-testid="inbox-approval-checkbox"
          />
        </div>

        {/* Main (click → details) */}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onOpenDetails(item)}
          data-testid="inbox-approval-open-details"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {/* 1. Primary identifier = name (fallback email handled in helper) */}
              <h3 className="truncate text-base font-semibold tracking-tight text-slate-50">
                {fields.displayName}
              </h3>
              <div className="mt-1 space-y-0.5 text-sm text-slate-400">
                {fields.email && fields.displayName !== fields.email ? (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {fields.email}
                  </p>
                ) : null}
                {fields.phone ? (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {fields.phone}
                  </p>
                ) : null}
              </div>
            </div>
            <Badge className="shrink-0 border-0 bg-blue-500/15 font-medium text-blue-200 hover:bg-blue-500/15">
              Pending
            </Badge>
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
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {fields.kindLabel}
            </span>
            {/* 2. Relative time */}
            {relative ? (
              <span className="text-slate-500" title={formatExactReceived(fields.createdAt)}>
                {relative}
              </span>
            ) : null}
          </div>

          {fields.hasDuplicate ? (
            <p className="mt-2 text-xs text-amber-300/90">Possible duplicate in FI</p>
          ) : null}

          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-300/90 group-hover:text-cyan-200">
            View details
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </p>
        </button>
      </div>

      {/* Per-card actions */}
      {canMutate ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onReject(item)}
            className="gap-1.5 border-white/[0.12] bg-transparent text-slate-200 hover:bg-white/[0.06]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || fields.blocked}
            onClick={() => onApprove(item)}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Read-only — import requires operator access.</p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// LeadDetailsPanel (shadcn Sheet)
// ---------------------------------------------------------------------------

function LeadDetailsPanel({
  open,
  item,
  fields,
  canMutate,
  busy,
  onOpenChange,
  onApprove,
  onReject,
}: {
  open: boolean;
  item: ImportReviewItem | null;
  fields: ApprovalCardFields | null;
  canMutate: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (item: ImportReviewItem) => void;
  onReject: (item: ImportReviewItem) => void;
}) {
  if (!item || !fields) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-white/[0.08] p-6">
            <SheetTitle>Lead details</SheetTitle>
            <SheetDescription>Select a lead to inspect.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        data-testid="inbox-lead-details-panel"
      >
        <SheetHeader className="border-b border-white/[0.08] p-6">
          <SheetTitle className="pr-6">{fields.displayName}</SheetTitle>
          <SheetDescription>
            {fields.kindLabel} · HubSpot {fields.hubspotId}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6 pb-8">
            {/* Identity */}
            <section className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Contact
              </h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Full name</dt>
                  <dd className="font-medium text-slate-100">{fields.displayName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-slate-200">{fields.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-200">{fields.phone ?? "—"}</dd>
                </div>
              </dl>
            </section>

            {/* Status / type / received */}
            <section className="space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Status
              </h4>
              <div className="flex flex-wrap gap-2">
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
              </div>
              <p className="text-sm text-slate-300">
                <span className="text-slate-500">Received: </span>
                {formatExactReceived(fields.createdAt)}
              </p>
              <p className="text-xs text-slate-500">
                {formatRelativeReceived(fields.createdAt)}
                {fields.hasDuplicate ? " · Possible duplicate in FI" : null}
              </p>
              <p className="text-xs text-slate-500">
                Proposed action:{" "}
                <span className="text-cyan-300/90">{fields.proposedAction}</span>
              </p>
            </section>

            {/* Enquiry message */}
            {fields.enquiryMessage ? (
              <section className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Original enquiry
                </h4>
                <p className="whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-black/20 p-3 text-sm leading-relaxed text-slate-200">
                  {fields.enquiryMessage}
                </p>
              </section>
            ) : null}

            {/* Form data */}
            {fields.formData.length > 0 ? (
              <section className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Form data
                </h4>
                <dl className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/20">
                  {fields.formData.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-1 gap-0.5 px-3 py-2 sm:grid-cols-3 sm:gap-2"
                    >
                      <dt className="break-all font-mono text-[11px] text-slate-500">{row.key}</dt>
                      <dd className="break-words text-sm text-slate-200 sm:col-span-2">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <p className="text-xs text-slate-500">No additional form fields on this record.</p>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t border-white/[0.08] p-4 sm:space-x-0">
          {canMutate ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onReject(item)}
                className="gap-1.5 border-white/[0.12] bg-transparent text-slate-200 hover:bg-white/[0.06]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Reject
              </Button>
              <Button
                type="button"
                disabled={busy || fields.blocked}
                onClick={() => onApprove(item)}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                Approve
              </Button>
            </div>
          ) : (
            <p className="w-full text-center text-xs text-slate-500">
              Read-only — import requires operator access.
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Bulk action bar (sticky / floating)
// ---------------------------------------------------------------------------

function BulkActionBar({
  count,
  busy,
  onApprove,
  onReject,
  onClear,
}: {
  count: number;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  if (count <= 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 w-[min(100%-1.5rem,36rem)] -translate-x-1/2",
        "rounded-2xl border border-cyan-400/30 bg-[#071018]/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-md"
      )}
      role="toolbar"
      aria-label="Bulk lead actions"
      data-testid="inbox-bulk-action-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-50">
            {count} selected
          </p>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onReject}
            className="gap-1.5 border-white/[0.12] bg-transparent text-slate-200 hover:bg-white/[0.06]"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Bulk Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onApprove}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Bulk Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PendingApprovalsList (main export)
// ---------------------------------------------------------------------------

/**
 * Inbox body: staged HubSpot leads/contacts awaiting explicit import into FI.
 */
export function PendingApprovalsList({
  tenantId,
  canMutate = true,
}: PendingApprovalsListProps) {
  const tid = tenantId.trim();
  const router = useRouter();
  const hubspotReviewHref = `/fi-admin/${tid}/settings/integrations/hubspot?tab=import-review`;

  const [items, setItems] = useState<ImportReviewItem[]>([]);
  const [integrationId, setIntegrationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bulkBusy, setBulkBusy] = useState(false);

  /** Selected card keys. */
  const [selected, setSelected] = useState<Set<ApprovalItemKey>>(() => new Set());

  /** Details sheet */
  const [detailsItem, setDetailsItem] = useState<ImportReviewItem | null>(null);
  const detailsOpen = detailsItem != null;
  const detailsFields = detailsItem ? toApprovalCardFields(detailsItem) : null;

  const fieldRows = useMemo(() => items.map((it) => ({ item: it, fields: toApprovalCardFields(it) })), [items]);

  const allKeys = useMemo(() => fieldRows.map((r) => r.fields.key), [fieldRows]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = selected.size > 0 && !allSelected;

  // ----- Data load -----
  const refresh = useCallback(() => {
    startTransition(async () => {
      // Real data path: HubSpot staged import review queue (approved staging → import).
      // TODO: If product wants import_status=staged (pre-approval) as well, extend loadImportReviewQueue.
      const res = await loadImportReviewQueueAction(tid, integrationId || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setItems(res.items ?? []);
      if (res.integrationId) setIntegrationId(res.integrationId);
      // Drop selection keys that no longer exist.
      setSelected((prev) => {
        const nextKeys = new Set((res.items ?? []).map(itemKey));
        const next = new Set<ApprovalItemKey>();
        for (const k of prev) {
          if (nextKeys.has(k)) next.add(k);
        }
        return next;
      });
    });
  }, [tid, integrationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const afterMutation = useCallback(() => {
    setActionError(null);
    setDetailsItem(null);
    setSelected(new Set());
    refresh();
    router.refresh();
  }, [refresh, router]);

  // ----- Single approve / reject -----
  const approveOne = useCallback(
    async (item: ImportReviewItem): Promise<boolean> => {
      if (!integrationId) {
        setActionError("No HubSpot integration loaded.");
        return false;
      }
      const stagingId = item.staging.id;
      const res =
        item.kind === "contact"
          ? await importHubspotContactAction(tid, integrationId, stagingId)
          : await importHubspotDealAction(tid, integrationId, stagingId);
      if (!res.ok) {
        setActionError(res.error);
        return false;
      }
      return true;
    },
    [tid, integrationId]
  );

  const rejectOne = useCallback(
    async (item: ImportReviewItem): Promise<boolean> => {
      if (!integrationId) {
        setActionError("No HubSpot integration loaded.");
        return false;
      }
      // Reject = cancel import / mark staging rejected via existing cancel path.
      // TODO: Dedicated rejectStagingAction if product wants reject without cancel semantics.
      const res = await cancelHubspotImportAction(
        tid,
        integrationId,
        item.kind,
        item.staging.id
      );
      if (!res.ok) {
        setActionError(res.error);
        return false;
      }
      return true;
    },
    [tid, integrationId]
  );

  const handleApprove = (item: ImportReviewItem) => {
    startTransition(async () => {
      const ok = await approveOne(item);
      if (ok) afterMutation();
    });
  };

  const handleReject = (item: ImportReviewItem) => {
    startTransition(async () => {
      const ok = await rejectOne(item);
      if (ok) afterMutation();
    });
  };

  // ----- Selection -----
  const toggleSelect = (key: ApprovalItemKey, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  };

  const selectAll = () => setSelected(new Set(allKeys));
  const deselectAll = () => setSelected(new Set());

  // ----- Bulk -----
  const selectedItems = useMemo(() => {
    return fieldRows.filter((r) => selected.has(r.fields.key)).map((r) => r.item);
  }, [fieldRows, selected]);

  const runBulk = async (mode: "approve" | "reject") => {
    if (!selectedItems.length || !canMutate) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      // Sequential to avoid rate limits / double-import races.
      // TODO: Optional server bulk endpoints: bulkImportHubspotContactsAction / bulkRejectStagingAction.
      const failures: string[] = [];
      for (const item of selectedItems) {
        const ok = mode === "approve" ? await approveOne(item) : await rejectOne(item);
        if (!ok) {
          const f = toApprovalCardFields(item);
          failures.push(f.displayName);
        }
      }
      if (failures.length) {
        setActionError(
          `${mode === "approve" ? "Approve" : "Reject"} failed for: ${failures.slice(0, 5).join(", ")}${
            failures.length > 5 ? "…" : ""
          }`
        );
      }
      afterMutation();
    } finally {
      setBulkBusy(false);
    }
  };

  const busy = pending || bulkBusy;

  return (
    <div
      className={cn("space-y-4", selected.size > 0 && "pb-24")}
      data-testid="pending-approvals-list"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0F1629]/60 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs leading-relaxed text-slate-400">
            Leads and contacts staged from HubSpot — they do not enter the clinic system until
            approved and imported here.
          </p>
          {canMutate && fieldRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={allSelected ? deselectAll : selectAll}
                className="h-8 gap-1.5 px-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-slate-100"
                data-testid="inbox-select-all"
              >
                {allSelected ? (
                  <>
                    <SquareCheck className="h-3.5 w-3.5" aria-hidden />
                    Deselect all
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" aria-hidden />
                    Select all
                    {someSelected ? ` (${selected.size})` : ""}
                  </>
                )}
              </Button>
              {selected.size > 0 ? (
                <span className="text-xs text-slate-500">{selected.size} selected</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Link
          href={hubspotReviewHref}
          className="shrink-0 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          Full HubSpot workspace →
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="text-sm text-amber-300" role="alert">
          {actionError}
        </p>
      ) : null}

      {pending && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading pending leads…
        </div>
      ) : null}

      {!pending && items.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-white/[0.12] p-12 text-center text-slate-400">
          No leads waiting for approval
        </div>
      ) : null}

      {fieldRows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {fieldRows.map(({ item, fields }) => (
            <ApprovalCard
              key={fields.key}
              item={item}
              fields={fields}
              selected={selected.has(fields.key)}
              canMutate={canMutate}
              busy={busy}
              onToggleSelect={toggleSelect}
              onOpenDetails={setDetailsItem}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      ) : null}

      {/* Bulk floating bar */}
      {canMutate ? (
        <BulkActionBar
          count={selected.size}
          busy={busy}
          onApprove={() => void runBulk("approve")}
          onReject={() => void runBulk("reject")}
          onClear={deselectAll}
        />
      ) : null}

      {/* Details sheet */}
      <LeadDetailsPanel
        open={detailsOpen}
        item={detailsItem}
        fields={detailsFields}
        canMutate={canMutate}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) setDetailsItem(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
