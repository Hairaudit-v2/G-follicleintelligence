"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PATIENT_PORTAL_IMAGE_SLOT_OPTIONS,
  type PatientPortalImageSlotSlug,
} from "@/src/lib/patientPortal/patientPortalImageUploadCore";

type UploadStatus = "idle" | "uploading" | "uploaded" | "error";

type PatientPortalUploadJson = {
  image?: { id?: string };
  error?: string;
};

function resolveUploadFailure(res: Response, body: PatientPortalUploadJson): string | null {
  if (res.ok) return null;
  return body.error?.trim() || `Upload failed (${res.status}).`;
}

export function PatientPortalImageUpload({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [slotSlug, setSlotSlug] = useState<PatientPortalImageSlotSlug>("fu_front");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      setStatus("uploading");
      setStatusMessage(null);

      const endpoint = `/api/patient/${encodeURIComponent(tenantId)}/images`;
      let uploadedCount = 0;
      let lastError: string | null = null;

      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("imaging_protocol_slot_slug", slotSlug);

        try {
          const res = await fetch(endpoint, { method: "POST", body: fd });
          const json = (await res.json().catch(() => ({}))) as PatientPortalUploadJson;
          const failure = resolveUploadFailure(res, json);
          if (failure) {
            lastError = failure;
            continue;
          }
          uploadedCount += 1;
        } catch (e) {
          lastError = e instanceof Error ? e.message : "Upload failed.";
        }
      }

      if (inputRef.current) inputRef.current.value = "";

      if (uploadedCount > 0) {
        setStatus("uploaded");
        setStatusMessage(
          uploadedCount === 1
            ? "Photo uploaded. Your clinic will review it shortly."
            : `${uploadedCount} photos uploaded.${lastError ? ` (${lastError})` : ""}`
        );
        router.refresh();
        return;
      }

      setStatus("error");
      setStatusMessage(lastError ?? "Upload failed.");
    },
    [router, slotSlug, tenantId]
  );

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-100">Upload follow-up photos</h2>
        <p className="text-sm text-slate-400">
          Share progress photos with your clinic. Use the same angle as your baseline visit when
          possible.
        </p>
      </div>

      <label className="block space-y-1 text-sm text-slate-300">
        <span className="font-medium text-slate-200">Photo angle</span>
        <select
          value={slotSlug}
          onChange={(e) => setSlotSlug(e.target.value as PatientPortalImageSlotSlug)}
          disabled={status === "uploading"}
          className="w-full max-w-sm rounded-lg border border-white/10 bg-[#0F1629] px-3 py-2 text-slate-100"
        >
          {PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
            status === "uploading"
              ? "cursor-not-allowed bg-slate-700 text-slate-300"
              : "bg-cyan-600 text-white hover:bg-cyan-500"
          }`}
        >
          {status === "uploading" ? "Uploading…" : "Choose photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={status === "uploading"}
            onChange={(e) => void onFilesSelected(e.target.files)}
          />
        </label>
      </div>

      {statusMessage ? (
        <p
          className={`text-sm ${
            status === "error"
              ? "text-rose-300"
              : status === "uploaded"
                ? "text-emerald-300"
                : "text-slate-400"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}