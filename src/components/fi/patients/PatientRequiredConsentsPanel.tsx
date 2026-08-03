"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Copy, ExternalLink, FileUp } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  issuePatientConsentLinkAction,
  recordStaffAssistedConsentAction,
} from "@/src/lib/actions/fi-consent-actions";
import type { PatientRequiredConsentsPanelData } from "@/src/lib/consents/consentTypes";
import { buildPatientDocumentsTabHref } from "@/src/lib/patients/patientTrialConsentShared";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "signed":
      return { label: "Signed", className: "bg-emerald-500/15 text-emerald-200" };
    case "outstanding":
      return { label: "Outstanding", className: "bg-amber-500/15 text-amber-200" };
    case "missing_template":
      return { label: "Template missing", className: "bg-rose-500/15 text-rose-200" };
    default:
      return { label: status, className: "bg-slate-500/15 text-slate-200" };
  }
}

function formatSignedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PatientRequiredConsentsPanel({
  tenantId,
  patientId,
  data,
  className,
}: {
  tenantId: string;
  patientId: string;
  data: PatientRequiredConsentsPanelData;
  className?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const documentsHref = buildPatientDocumentsTabHref(tenantId, patientId);

  const onRecordStaffAssisted = (instanceId: string) => {
    setError(null);
    setLinkNote(null);
    setPendingId(instanceId);
    startTransition(async () => {
      const res = await recordStaffAssistedConsentAction({
        tenantId,
        patientId,
        instanceId,
      });
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onCopyPatientLink = (instanceId: string) => {
    setError(null);
    setLinkNote(null);
    setPendingId(`link:${instanceId}`);
    startTransition(async () => {
      const res = await issuePatientConsentLinkAction({
        tenantId,
        patientId,
        instanceId,
        clinicDevice: false,
      });
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setLinkNote(`Patient link copied. Expires ${formatExpiry(res.expiresAt)}.`);
      } catch {
        setLinkNote(`Link ready (copy manually): ${res.url} — expires ${formatExpiry(res.expiresAt)}.`);
      }
    });
  };

  const onOpenClinicDevice = (instanceId: string) => {
    setError(null);
    setLinkNote(null);
    setPendingId(`clinic:${instanceId}`);
    startTransition(async () => {
      const res = await issuePatientConsentLinkAction({
        tenantId,
        patientId,
        instanceId,
        clinicDevice: true,
      });
      setPendingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLinkNote(`Clinic device link opens in a new tab. Expires ${formatExpiry(res.expiresAt)}.`);
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  if (!data.ok) {
    return (
      <section id="required-consents" className={cn(crmLeadCardClass, className)}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
          Required consents
        </h2>
        <p className="mt-2 text-sm text-amber-100/90" role="status">
          {data.message}
        </p>
      </section>
    );
  }

  const outstandingCount = data.items.filter((i) => i.status !== "signed").length;

  return (
    <section id="required-consents" className={cn(crmLeadCardClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ClipboardCheck className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
            Required consents
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Treatment-driven forms for this patient. Draft template text is marked{" "}
            <span className="font-medium text-amber-200/90">DRAFT — not legal-final</span> until
            counsel approves. Send a patient link or record staff-assisted sign-off.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            data.allRequiredSigned
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
          )}
        >
          {data.allRequiredSigned
            ? "All required signed"
            : `${outstandingCount} outstanding`}
        </span>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {linkNote ? (
        <p className="mt-3 text-sm text-cyan-100/90" role="status">
          {linkNote}
        </p>
      ) : null}

      {data.items.length === 0 || data.allRequiredSigned ? (
        <p className="mt-4 text-sm text-emerald-100/90" role="status">
          {data.items.length === 0
            ? "No required consents for this patient right now."
            : "All required consents are signed."}
        </p>
      ) : null}

      {data.items.length > 0 ? (
        <ul className="mt-4 divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
          {data.items.map((item) => {
            const badge = statusBadge(item.status);
            const canAct = item.status === "outstanding" && Boolean(item.instanceId);
            return (
              <li key={item.formKey} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.formKey} · v{item.version}
                      {item.reasons.length > 0 ? ` · ${item.reasons[0]}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                </div>

                {item.status === "signed" ? (
                  <p className="text-xs text-slate-400">
                    Signed {formatSignedAt(item.signedAt)}
                    {item.signedName ? ` · ${item.signedName}` : ""}
                  </p>
                ) : null}

                {item.bodyPreview?.includes("DRAFT") ? (
                  <p className="text-xs text-amber-200/80">
                    Template is DRAFT — not legal-final.
                  </p>
                ) : null}

                {canAct ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCopyPatientLink(item.instanceId!)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {pending && pendingId === `link:${item.instanceId}`
                        ? "Creating…"
                        : "Copy patient link"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onOpenClinicDevice(item.instanceId!)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {pending && pendingId === `clinic:${item.instanceId}`
                        ? "Opening…"
                        : "Open for clinic device"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onRecordStaffAssisted(item.instanceId!)}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.03] disabled:opacity-50"
                    >
                      {pending && pendingId === item.instanceId
                        ? "Recording…"
                        : "Record staff-assisted"}
                    </button>
                    <a
                      href={documentsHref}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.03]"
                    >
                      <FileUp className="h-3.5 w-3.5" aria-hidden />
                      Upload evidence
                    </a>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
