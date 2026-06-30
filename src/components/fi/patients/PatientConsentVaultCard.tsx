"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PatientTrialConsentGateView } from "@/src/lib/patients/patientTrialConsentShared";
import { buildPatientDocumentsTabHref } from "@/src/lib/patients/patientTrialConsentShared";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

type ConsentDocumentRow = {
  id: string;
  original_filename: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  notes: string | null;
  created_at: string;
  signed_url: string | null;
};

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PatientConsentVaultCard({
  tenantId,
  patientId,
  trialConsentGate,
  className,
}: {
  tenantId: string;
  patientId: string;
  trialConsentGate: PatientTrialConsentGateView;
  className?: string;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<ConsentDocumentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const loadDocuments = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/documents?document_type=consent`,
        { credentials: "include" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        documents?: ConsentDocumentRow[];
      };
      if (!res.ok || !json.ok) {
        setLoadError(json.error ?? `Could not load documents (${res.status}).`);
        return;
      }
      setDocuments(json.documents ?? []);
    } catch {
      setLoadError("Network error while loading consent documents.");
    }
  }, [patientId, tenantId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const onUpload = (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (notes.trim()) fd.set("notes", notes.trim());
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/documents`,
          { method: "POST", body: fd, credentials: "include" }
        );
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setUploadError(json.error ?? `Upload failed (${res.status}).`);
          return;
        }
        setNotes("");
        await loadDocuments();
        router.refresh();
      } catch {
        setUploadError("Network error while uploading consent document.");
      }
    });
  };

  const gateBlocked = trialConsentGate.required && !trialConsentGate.satisfied;
  const documentsHref = buildPatientDocumentsTabHref(tenantId, patientId);

  return (
    <section className={cn(crmLeadCardClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileText className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
            Consent vault
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Store signed photography and treatment consent (PDF, JPEG, or PNG). Required before
            clinical photography and consultation completion when the trial consent gate is enabled.
          </p>
        </div>
        {trialConsentGate.required ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              trialConsentGate.satisfied
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-amber-500/15 text-amber-200"
            )}
          >
            {trialConsentGate.satisfied ? "Consent recorded" : "Consent required"}
          </span>
        ) : null}
      </div>

      {gateBlocked ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          Upload at least one consent document below to unlock imaging capture and consultation
          completion for this patient.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-300">
          Upload consent document
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#020617] px-3 text-sm font-semibold text-slate-100 hover:bg-white/[0.03]">
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
              {pending ? "Uploading…" : "Choose file"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                className="sr-only"
                disabled={pending}
                onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-xs text-slate-500">PDF, JPEG, or PNG · max 15 MB</span>
          </div>
        </label>

        <label className="block text-xs font-medium text-slate-300">
          Notes (optional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Signed in clinic 1 Jul 2026"
            className="mt-1 block w-full rounded border border-slate-700 bg-[#020617] px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>

        {uploadError ? (
          <p className="text-sm text-rose-300" role="alert">
            {uploadError}
          </p>
        ) : null}
        {loadError ? (
          <p className="text-sm text-rose-300" role="alert">
            {loadError}
          </p>
        ) : null}
      </div>

      {documents.length > 0 ? (
        <ul className="mt-4 divide-y divide-white/[0.06] rounded-lg border border-white/[0.08]">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {doc.original_filename ?? "Consent document"}
                </p>
                <p className="text-xs text-slate-500">
                  {doc.created_at.slice(0, 10)} · {formatBytes(doc.file_size_bytes)}
                  {doc.notes ? ` · ${doc.notes}` : ""}
                </p>
              </div>
              {doc.signed_url ? (
                <a
                  href={doc.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-cyan-300 underline hover:text-cyan-200"
                >
                  View
                </a>
              ) : (
                <span className="text-xs text-slate-500">Preview unavailable</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No consent documents uploaded yet.</p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Blood test request PDFs from DoctorOS remain on the treatment timeline.{" "}
        <Link href={documentsHref} className="font-medium text-cyan-300 underline">
          Documents tab
        </Link>
      </p>
    </section>
  );
}