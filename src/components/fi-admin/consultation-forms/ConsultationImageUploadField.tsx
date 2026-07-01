"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";
import {
  normalizeConsultationImageUploadValue,
  nowIso,
  type ConsultationImageUploadFieldValue,
} from "@/src/lib/consultationForms/consultationFormImageUploadModel";
import type { ConsultationFormPersistenceContext } from "@/src/lib/consultationForms/consultationFormTypes";

type UploadStatus = "idle" | "uploading" | "uploaded" | "error";

type PatientImageUploadJson = {
  image?: { id?: string };
  error?: string;
  message?: string;
};

function resolveUploadFailure(res: Response, body: PatientImageUploadJson): string | null {
  if (res.ok) return null;
  const msg = body.error ?? body.message;
  return msg?.trim() || `Upload failed (${res.status}).`;
}

export function ConsultationImageUploadReadOnlySummary({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const normalized = useMemo(() => normalizeConsultationImageUploadValue(value), [value]);
  const count = normalized.image_ids.length;
  return (
    <FiCard className="border border-white/[0.08] bg-white/[0.03] p-4">
      <p className={cn("text-sm font-semibold", fiOsLightFormSurfaceClassNames.labelInline)}>
        {label}
      </p>
      <p className={cn("mt-1", fiOsLightFormSurfaceClassNames.helper)}>
        {count === 0
          ? "No scalp images uploaded."
          : `${count} scalp image${count === 1 ? "" : "s"} uploaded.`}
      </p>
    </FiCard>
  );
}

export function ConsultationImageUploadField({
  fieldId,
  label,
  description,
  required,
  value,
  onChange,
  disabled,
  persistence,
}: {
  fieldId: string;
  label: string;
  description?: string | null;
  required?: boolean;
  value: unknown;
  onChange: (next: ConsultationImageUploadFieldValue) => void;
  disabled: boolean;
  persistence: ConsultationFormPersistenceContext | null;
}) {
  const normalized = useMemo(() => normalizeConsultationImageUploadValue(value), [value]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const canUpload = Boolean(
    persistence?.tenantId?.trim() &&
      persistence?.patientId?.trim() &&
      persistence?.consultationId?.trim()
  );

  const commitUpload = useCallback(
    (imageId: string, filename: string) => {
      const current = normalizeConsultationImageUploadValue(valueRef.current);
      const uploadedAt = nowIso();
      const nextIds = current.image_ids.includes(imageId)
        ? current.image_ids
        : [...current.image_ids, imageId];
      const nextUploads = [
        ...(current.uploads ?? []).filter((u) => u.image_id !== imageId),
        { image_id: imageId, filename, uploaded_at: uploadedAt },
      ];
      onChange({ image_ids: nextIds, uploads: nextUploads });
    },
    [onChange]
  );

  const onFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled) return;
      if (!canUpload || !persistence) {
        setStatus("error");
        setStatusMessage("Link a patient on the consultation before uploading images.");
        return;
      }

      const tenantId = persistence.tenantId.trim();
      const patientId = persistence.patientId!.trim();
      const consultationId = persistence.consultationId.trim();
      const formInstanceId = persistence.formInstanceId?.trim() || "";
      const caseId = persistence.caseId?.trim() || "";

      setStatus("uploading");
      setStatusMessage(null);

      const endpoint = `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`;
      let uploadedCount = 0;
      let lastError: string | null = null;

      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("image_category", "scalp");
        fd.set("capture_source", "consultation_os");
        fd.set("consultation_id", consultationId);
        if (formInstanceId) fd.set("form_instance_id", formInstanceId);
        fd.set("form_field_id", fieldId);
        if (caseId) fd.set("case_id", caseId);

        try {
          const res = await fetch(endpoint, { method: "POST", body: fd });
          const json = (await res.json().catch(() => ({}))) as PatientImageUploadJson;
          const failure = resolveUploadFailure(res, json);
          if (failure) {
            lastError = failure;
            continue;
          }
          const imageId = json.image?.id?.trim();
          if (!imageId) {
            lastError = "Upload succeeded but image id was missing.";
            continue;
          }
          commitUpload(imageId, file.name || "image");
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
            ? "Image uploaded."
            : `${uploadedCount} images uploaded.${lastError ? ` (${lastError})` : ""}`
        );
        return;
      }

      setStatus("error");
      setStatusMessage(lastError ?? "Upload failed.");
    },
    [canUpload, commitUpload, disabled, fieldId, persistence]
  );

  const uploadCount = normalized.image_ids.length;

  return (
    <div className="space-y-2">
      <div>
        <div className={fiOsLightFormSurfaceClassNames.labelInline}>
          {label}
          {required ? (
            <span className={fiOsLightFormSurfaceClassNames.requiredMark}> *</span>
          ) : null}
        </div>
        {description?.trim() ? (
          <p className={cn("mt-0.5", fiOsLightFormSurfaceClassNames.helper)}>{description}</p>
        ) : null}
      </div>

      <p className={fiOsLightFormSurfaceClassNames.helper}>
        Upload scalp photos for this consultation. Images are stored in the patient imaging library
        and linked to this form field.
      </p>

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={cn(
              "inline-flex min-h-[44px] cursor-pointer touch-manipulation items-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition",
              status === "uploading" || !canUpload
                ? "cursor-not-allowed bg-slate-700 text-slate-300"
                : "bg-sky-600 text-white hover:bg-sky-700"
            )}
          >
            {status === "uploading" ? "Uploading…" : "Choose images"}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={disabled || status === "uploading" || !canUpload}
              onChange={(e) => void onFilesSelected(e.target.files)}
            />
          </label>
          {uploadCount > 0 ? (
            <span className={fiOsLightFormSurfaceClassNames.helper}>
              {uploadCount} image{uploadCount === 1 ? "" : "s"} linked
            </span>
          ) : null}
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className={cn(
            "text-sm",
            status === "error"
              ? "text-rose-300"
              : status === "uploaded"
                ? "text-emerald-300"
                : fiOsLightFormSurfaceClassNames.helper
          )}
        >
          {statusMessage}
        </p>
      ) : null}

      {!canUpload && !disabled ? (
        <p className="text-sm text-amber-300">
          Link a patient on the consultation workspace before uploading images.
        </p>
      ) : null}

      {uploadCount > 0 ? (
        <FiCard className="border border-white/[0.08] bg-white/[0.03] p-3">
          <ul className="space-y-1 text-sm text-slate-300">
            {(normalized.uploads ?? []).map((entry) => (
              <li key={entry.image_id} className="truncate">
                {entry.filename}
              </li>
            ))}
          </ul>
        </FiCard>
      ) : null}
    </div>
  );
}