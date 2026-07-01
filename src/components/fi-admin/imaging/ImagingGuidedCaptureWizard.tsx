"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createImagingProtocolSessionAction,
  finishGuidedProtocolSessionAction,
  recordPatientPhotoQuickActionCompletedAction,
  skipGuidedProtocolSlotAction,
} from "@/lib/actions/fi-imaging-actions";
import { inferCaptureDeviceType } from "@/src/lib/imagingOs/imagingOsConstants";
import type { ImagingOsPatientPayload } from "@/src/lib/imagingOs/imagingOsLoad.server";
import { buildGuidedImageUploadFields } from "@/src/lib/imagingOs/imagingOsGuidedFields";
import {
  postGuidedCaptureImage,
  resolveGuidedCaptureUploadException,
  resolveGuidedCaptureUploadFailure,
  type GuidedCaptureUploadJson,
} from "@/src/lib/imagingOs/imagingGuidedCaptureUpload.client";
import {
  defaultSlotInstruction,
  isSessionMarkedComplete,
  missingRequiredSlotSlugs,
  nextRecommendedSlotSlug,
  parseProgressMeta,
  slotIsSatisfied,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import { PatientTrialConsentBanner } from "@/src/components/fi/patients/PatientTrialConsentBanner";
import { resolveGuidedCaptureSource } from "@/src/lib/imaging-core/ingest/resolveGuidedCaptureSource";
import {
  buildPatientProfilePhotoAddedHref,
  type PatientImagingCaptureIntent,
  type PatientPhotoQuickActionSource,
} from "@/src/lib/patientImages/patientImagingCaptureRoutes";
import type { PatientTrialConsentGateView } from "@/src/lib/patients/patientTrialConsentShared";
import { isPatientTrialConsentCaptureAllowed } from "@/src/lib/patients/patientTrialConsentShared";

const EMPTY_PROGRESS: Record<string, unknown> = {};
const EMPTY_SLOTS: ProtocolSlotDef[] = [];

function readImageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

const GUIDED_TEMPLATE_SLUGS = [
  "hair_loss_consultation",
  "hair_transplant_planning",
  "surgery_day",
  "follow_up_review",
  "trichoscopy_review",
] as const;

function firstOpenSessionId(sessions: ImagingOsPatientPayload["protocolSessions"]): string {
  for (const s of sessions) {
    if (!isSessionMarkedComplete(s.progress)) return s.id;
  }
  return "";
}

export function ImagingGuidedCaptureWizard({
  tenantId,
  patientId,
  adminKey,
  initial,
  trialConsentGate,
  captureIntent = null,
  captureSource = null,
}: {
  tenantId: string;
  patientId: string;
  trialConsentGate?: PatientTrialConsentGateView | null;
  adminKey: string;
  initial: ImagingOsPatientPayload;
  captureIntent?: PatientImagingCaptureIntent | null;
  captureSource?: PatientPhotoQuickActionSource | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sessionId, setSessionId] = useState<string>(() =>
    firstOpenSessionId(initial.protocolSessions)
  );
  const [slotOverride, setSlotOverride] = useState<string | null>(null);
  const [replaceNext, setReplaceNext] = useState(false);
  const [clinicIdInput, setClinicIdInput] = useState("");
  const [staffIdInput, setStaffIdInput] = useState("");
  const [lastPreviewUrl, setLastPreviewUrl] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastCaptureFile, setLastCaptureFile] = useState<File | null>(null);

  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const sessionStartAttempted = useRef(false);
  const captureOpenAttempted = useRef(false);
  const uploadInFlightRef = useRef(false);

  useEffect(() => {
    setSessionId((prev) => {
      if (prev && initial.protocolSessions.some((s) => s.id === prev)) return prev;
      return firstOpenSessionId(initial.protocolSessions);
    });
  }, [initial.protocolSessions]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (lastPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(lastPreviewUrl);
    };
  }, [lastPreviewUrl]);

  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const currentSession = useMemo(
    () => initial.protocolSessions.find((s) => s.id === sessionId) ?? null,
    [initial.protocolSessions, sessionId]
  );

  const resolvedCaptureSource = useMemo(() => {
    if (!currentSession?.template_slug) {
      return captureSource ?? "imaging_os_wizard";
    }
    return resolveGuidedCaptureSource({
      protocolTemplateSlug: currentSession.template_slug,
      explicitCaptureSource: captureSource,
      guidedSurface: "imaging_os",
    });
  }, [captureSource, currentSession?.template_slug]);

  const template = useMemo(
    () => initial.protocolTemplates.find((t) => t.slug === currentSession?.template_slug) ?? null,
    [initial.protocolTemplates, currentSession?.template_slug]
  );

  const slots = useMemo(() => template?.slots ?? EMPTY_SLOTS, [template]);
  const progress = useMemo(() => {
    const p = currentSession?.progress;
    if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    return EMPTY_PROGRESS;
  }, [currentSession]);

  const computedNext = useMemo(() => {
    if (!slots.length) return null;
    return nextRecommendedSlotSlug(slots, progress);
  }, [slots, progress]);

  const currentSlug = slotOverride ?? computedNext ?? slots[0]?.slug ?? null;
  const currentSlot = slots.find((s) => s.slug === currentSlug) ?? null;

  const missing = useMemo(() => missingRequiredSlotSlugs(slots, progress), [slots, progress]);
  const pct = currentSession?.completion_percent ?? 0;
  const sessionComplete = currentSession ? isSessionMarkedComplete(progress) : false;

  const showFlash = useCallback((kind: "success" | "error", text: string) => {
    setToast({ kind, text });
  }, []);

  const consentCaptureAllowed = isPatientTrialConsentCaptureAllowed(trialConsentGate);

  const uploadFile = useCallback(
    (file: File | null) => {
      if (!file || !currentSession || !currentSlug || sessionComplete) return;
      if (pending || uploadInFlightRef.current) return;
      if (!consentCaptureAllowed) {
        showFlash("error", "Record patient consent on the Documents tab before uploading images.");
        return;
      }

      setUploadError(null);

      if (lastPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(lastPreviewUrl);
      const preview = URL.createObjectURL(file);
      setLastPreviewUrl(preview);
      setLastCaptureFile(file);

      const slot = slots.find((s) => s.slug === currentSlug);
      const fields = buildGuidedImageUploadFields({
        templateSlug: currentSession.template_slug,
        slotSlug: currentSlug,
        deviceType: inferCaptureDeviceType(
          typeof navigator !== "undefined" ? navigator.userAgent : ""
        ),
        clinicId: clinicIdInput.trim() || null,
        capturedByStaffId: staffIdInput.trim() || null,
        suggestedRegion: slot?.suggested_region ?? null,
      });

      startTransition(async () => {
        uploadInFlightRef.current = true;
        try {
          const dims = await readImageDimensions(file);
          const fd = new FormData();
          fd.set("file", file);
          fd.set("image_category", "scalp");
          fd.set("protocol_session_id", currentSession.id);
          fd.set("imaging_library_axis", fields.imaging_library_axis);
          fd.set("visit_type", fields.visit_type);
          fd.set("imaging_protocol_template_slug", fields.imaging_protocol_template_slug);
          fd.set("imaging_protocol_slot_slug", fields.imaging_protocol_slot_slug);
          if (fields.anatomical_region) fd.set("anatomical_region", fields.anatomical_region);
          fd.set("device_type", fields.device_type);
          if (fields.clinic_id) fd.set("clinic_id", fields.clinic_id);
          if (fields.captured_by_staff_id)
            fd.set("captured_by_staff_id", fields.captured_by_staff_id);
          if (replaceNext) fd.set("guided_replace", "1");
          fd.set("capture_type", captureIntent === "camera" ? "camera" : "upload");
          fd.set("capture_source", resolvedCaptureSource);
          if (dims.width) fd.set("image_width", String(dims.width));
          if (dims.height) fd.set("image_height", String(dims.height));
          const k = adminKey.trim();
          if (k) fd.set("adminKey", k);

          let res: Response;
          let j: GuidedCaptureUploadJson;
          try {
            const result = await postGuidedCaptureImage(
              `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`,
              fd
            );
            res = result.response;
            j = result.json;
          } catch (e) {
            const msg = resolveGuidedCaptureUploadException(e);
            console.error("[ImagingGuidedCaptureWizard] upload failed", e);
            setUploadError(msg);
            showFlash("error", msg);
            return;
          }

          const failureMsg = resolveGuidedCaptureUploadFailure(res, j);
          if (failureMsg) {
            setUploadError(failureMsg);
            showFlash("error", failureMsg);
            return;
          }

          const qualityAlert = j.attribution?.quality?.alert_message;

          if (captureIntent && captureSource) {
            setUploadError(null);
            setLastCaptureFile(null);
            setReplaceNext(false);
            if (camRef.current) camRef.current.value = "";
            if (libRef.current) libRef.current.value = "";
            void recordPatientPhotoQuickActionCompletedAction({
              tenantId,
              patientId,
              intent: captureIntent,
              source: captureSource,
            });
            router.push(buildPatientProfilePhotoAddedHref(tenantId, patientId, { tab: "gallery" }));
            return;
          }

          const g = j.guided_session;
          if (g) {
            const base = g.sessionCompleted
              ? "Session complete — all required views captured."
              : "Image saved.";
            showFlash(
              qualityAlert ? "error" : "success",
              qualityAlert ? `${qualityAlert} ${base}` : base
            );
            if (g.nextSlotSlug) setSlotOverride(g.nextSlotSlug);
            else setSlotOverride(null);
          } else {
            showFlash(qualityAlert ? "error" : "success", qualityAlert ?? "Image saved.");
          }
          setUploadError(null);
          setLastCaptureFile(null);
          setReplaceNext(false);
          router.refresh();
          if (camRef.current) camRef.current.value = "";
          if (libRef.current) libRef.current.value = "";
        } catch (e) {
          const msg = resolveGuidedCaptureUploadException(e);
          console.error("[ImagingGuidedCaptureWizard] upload failed", e);
          setUploadError(msg);
          showFlash("error", msg);
        } finally {
          uploadInFlightRef.current = false;
        }
      });
    },
    [
      adminKey,
      clinicIdInput,
      consentCaptureAllowed,
      currentSession,
      currentSlug,
      lastPreviewUrl,
      captureIntent,
      captureSource,
      resolvedCaptureSource,
      patientId,
      pending,
      replaceNext,
      router,
      sessionComplete,
      showFlash,
      slots,
      staffIdInput,
      tenantId,
    ]
  );

  const onStartTemplate = useCallback(
    (templateSlug: string) => {
      startTransition(async () => {
        const res = await createImagingProtocolSessionAction(
          tenantId,
          patientId,
          withAdmin({ templateSlug })
        );
        if (!res.ok) {
          showFlash("error", res.error);
          return;
        }
        setSessionId(res.sessionId);
        setSlotOverride(null);
        showFlash("success", "Guided session started.");
        router.refresh();
      });
    },
    [patientId, router, showFlash, tenantId, withAdmin]
  );

  const onSkip = useCallback(() => {
    if (!currentSession || !currentSlug || !skipReason.trim()) return;
    const slot = slots.find((s) => s.slug === currentSlug);
    if (!slot || slot.required !== false) return;
    startTransition(async () => {
      const res = await skipGuidedProtocolSlotAction(
        tenantId,
        patientId,
        withAdmin({
          sessionId: currentSession.id,
          slotSlug: currentSlug,
          reason: skipReason.trim(),
        })
      );
      if (!res.ok) {
        showFlash("error", res.error);
        return;
      }
      showFlash(
        "success",
        res.sessionCompleted ? "Optional slot skipped — session complete." : "Slot skipped."
      );
      if (res.nextSlotSlug) setSlotOverride(res.nextSlotSlug);
      else setSlotOverride(null);
      setSkipOpen(false);
      setSkipReason("");
      router.refresh();
    });
  }, [
    currentSession,
    currentSlug,
    patientId,
    router,
    showFlash,
    skipReason,
    slots,
    tenantId,
    withAdmin,
  ]);

  const onFinish = useCallback(() => {
    if (!currentSession || sessionComplete) return;
    startTransition(async () => {
      const res = await finishGuidedProtocolSessionAction(
        tenantId,
        patientId,
        withAdmin({ sessionId: currentSession.id })
      );
      if (!res.ok) {
        showFlash("error", res.error);
        return;
      }
      showFlash("success", "Session finished.");
      router.refresh();
    });
  }, [currentSession, patientId, router, sessionComplete, showFlash, tenantId, withAdmin]);

  const orderedTemplates = useMemo(() => {
    const bySlug = new Map(initial.protocolTemplates.map((t) => [t.slug, t]));
    const out: typeof initial.protocolTemplates = [];
    for (const slug of GUIDED_TEMPLATE_SLUGS) {
      const row = bySlug.get(slug);
      if (row) out.push(row);
    }
    return out;
  }, [initial]);

  useEffect(() => {
    if (!captureIntent || pending) return;

    if (!currentSession && !sessionStartAttempted.current) {
      const defaultTemplate = orderedTemplates[0];
      if (!defaultTemplate) return;
      sessionStartAttempted.current = true;
      onStartTemplate(defaultTemplate.slug);
      return;
    }

    if (currentSession && currentSlot && !sessionComplete && !captureOpenAttempted.current) {
      captureOpenAttempted.current = true;
      const t = window.setTimeout(() => {
        const input = captureIntent === "library" ? libRef.current : camRef.current;
        input?.click();
      }, 150);
      return () => window.clearTimeout(t);
    }
  }, [
    captureIntent,
    currentSession,
    currentSlot,
    onStartTemplate,
    orderedTemplates,
    pending,
    sessionComplete,
  ]);

  return (
    <section className="space-y-6 rounded-xl border border-white/[0.08] bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      {toast ? (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.kind === "success"
              ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-200"
              : "bg-rose-500/10 text-rose-300 ring-1 ring-red-200"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
          Guided clinical capture
        </h2>
        <p className="max-w-2xl text-sm text-slate-400">
          Touch-friendly workflow for iPad and phones. Uses the device camera or photo library;
          images stay in private patient storage with signed thumbnails only.
        </p>
      </header>

      <PatientTrialConsentBanner
        tenantId={tenantId}
        patientId={patientId}
        trialConsentGate={trialConsentGate}
      />

      {!currentSession ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 p-6 text-center">
          <p className="text-sm font-medium text-slate-200">No active session</p>
          <p className="mt-1 text-xs text-slate-400">
            Choose a protocol template to begin guided capture.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {orderedTemplates.map((t) => (
              <button
                key={t.slug}
                type="button"
                disabled={pending}
                onClick={() => onStartTemplate(t.slug)}
                className="min-h-[48px] rounded-lg border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-4 py-3 text-left text-sm font-medium text-slate-100 shadow-sm hover:bg-white/[0.03] active:bg-white/[0.06] disabled:opacity-50"
              >
                <span className="block">{t.name}</span>
                {t.protocol_catalog_source ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                    {t.protocol_catalog_source}
                    {t.protocol_catalog_version ? ` · ${t.protocol_catalog_version}` : ""}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block min-w-0 flex-1 text-xs font-medium text-slate-300">
              Active session
              <select
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setSlotOverride(null);
                }}
                className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-2 text-sm"
              >
                {initial.protocolSessions.map((s) => {
                  const tpl = initial.protocolTemplates.find((t) => t.slug === s.template_slug);
                  const done = isSessionMarkedComplete(s.progress);
                  return (
                    <option key={s.id} value={s.id}>
                      {(tpl?.name ?? s.template_slug).slice(0, 64)}{" "}
                      {done ? "· complete" : "· active"}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || sessionComplete}
                onClick={onFinish}
                className="min-h-[44px] min-w-[140px] rounded-lg border border-gray-800 bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400"
              >
                Finish session
              </button>
            </div>
          </div>

          {sessionComplete ? (
            <p className="rounded-lg bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-200">
              This session is marked complete. Start a new session from the protocols tab or pick
              another active session above.
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Session progress
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-slate-100">{pct}%</span>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Missing (required)
                </h3>
                {missing.length === 0 ? (
                  <p className="mt-1 text-sm text-emerald-300">
                    None — all required slots satisfied.
                  </p>
                ) : (
                  <ul className="mt-1 list-inside list-disc text-sm text-slate-200">
                    {missing.map((slug) => (
                      <li key={slug}>{slots.find((s) => s.slug === slug)?.label ?? slug}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Optional metadata
              </h3>
              <label className="block text-xs text-slate-400">
                Clinic ID (UUID)
                <input
                  value={clinicIdInput}
                  onChange={(e) => setClinicIdInput(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-700 px-3 font-mono text-sm"
                  placeholder="Optional"
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Capturing staff ID (UUID)
                <input
                  value={staffIdInput}
                  onChange={(e) => setStaffIdInput(e.target.value)}
                  className="mt-1 block w-full min-h-[44px] rounded-lg border border-slate-700 px-3 font-mono text-sm"
                  placeholder="Optional"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-900 bg-gray-900 p-4 text-white sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
              Current slot
            </h3>
            {currentSlot ? (
              <>
                <p className="mt-2 text-xl font-semibold sm:text-2xl">{currentSlot.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">
                  {defaultSlotInstruction(currentSlot)}
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  Status:{" "}
                  <span className="font-medium text-white">
                    {slotIsSatisfied(currentSlot, progress) ? "Captured" : "Not captured"}
                  </span>
                  {currentSlot.required === false ? (
                    <span className="text-gray-500"> · Optional</span>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No slots in this template.</p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => uploadFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={libRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={pending || !currentSlot || sessionComplete || !consentCaptureAllowed}
                onClick={() => camRef.current?.click()}
                className="min-h-[52px] flex-1 rounded-xl bg-[#0F1629]/80 backdrop-blur-md px-4 text-base font-semibold text-slate-100 shadow hover:bg-white/[0.06] disabled:opacity-40"
              >
                {pending ? "Uploading…" : "Take photo"}
              </button>
              <button
                type="button"
                disabled={pending || !currentSlot || sessionComplete || !consentCaptureAllowed}
                onClick={() => libRef.current?.click()}
                className="min-h-[52px] flex-1 rounded-xl border border-white/40 px-4 text-base font-semibold text-white hover:bg-white/10 disabled:opacity-40"
              >
                From library
              </button>
            </div>

            {uploadError ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {uploadError}
              </p>
            ) : null}
            {uploadError && lastCaptureFile ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => uploadFile(lastCaptureFile)}
                className="mt-3 min-h-[44px] rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-40"
              >
                Retry upload
              </button>
            ) : null}

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={replaceNext}
                onChange={(e) => setReplaceNext(e.target.checked)}
                className="h-5 w-5 rounded border-gray-500"
              />
              Retake / replace for this slot (archives the previous image for this slot)
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Captured
              </h3>
              {lastPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lastPreviewUrl}
                  alt="Latest capture preview"
                  className="mt-2 h-40 w-full rounded-lg object-cover"
                />
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  After each upload, a thumbnail preview appears here.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Slot checklist
              </h3>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
                {slots.map((s) => {
                  const ok = slotIsSatisfied(s, progress);
                  const active = s.slug === currentSlug;
                  const slotMeta = parseProgressMeta(progress);
                  const pending = slotMeta.vie_pending?.[s.slug];
                  const quality = slotMeta.vie_slot_quality?.[s.slug];
                  const statusLabel = pending
                    ? "Review pending"
                    : ok
                      ? quality
                        ? `${quality.quality_score}/100${quality.clinically_usable ? "" : " ⚠"}`
                        : "Done"
                      : "Open";
                  return (
                    <li key={s.slug}>
                      <button
                        type="button"
                        disabled={sessionComplete}
                        onClick={() => setSlotOverride(s.slug)}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left ${
                          active
                            ? "bg-gray-900 text-white"
                            : ok
                              ? "bg-emerald-500/10 text-emerald-300"
                              : pending
                                ? "bg-amber-400/10 text-amber-200"
                                : "bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className="pr-2">{s.label}</span>
                        <span className="shrink-0 text-xs font-medium">{statusLabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {currentSlot?.required === false && !slotIsSatisfied(currentSlot, progress) ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || sessionComplete}
                onClick={() => setSkipOpen(true)}
                className="min-h-[44px] rounded-lg border border-slate-600 bg-[#0F1629]/80 backdrop-blur-md px-4 text-sm font-medium text-slate-200 hover:bg-white/[0.03]"
              >
                Skip with reason…
              </button>
            </div>
          ) : null}

          {skipOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-md rounded-xl bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-xl">
                <h4 className="text-base font-semibold text-slate-100">Skip optional slot</h4>
                <p className="mt-1 text-xs text-slate-400">Required views cannot be skipped.</p>
                <textarea
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-slate-700 p-2 text-sm"
                  placeholder="Clinical reason (visible in session progress metadata)"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]"
                    onClick={() => setSkipOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending || !skipReason.trim()}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-400"
                    onClick={onSkip}
                  >
                    Confirm skip
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Start another guided session
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {orderedTemplates.map((t) => (
                <button
                  key={`extra-${t.slug}`}
                  type="button"
                  disabled={pending}
                  onClick={() => onStartTemplate(t.slug)}
                  className="min-h-[40px] rounded-lg border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  + {t.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!currentSession ? (
        <p className="text-center text-xs text-gray-500">
          Sessions you create here also appear under the Protocols tab.
        </p>
      ) : null}

      {pending ? <p className="text-center text-xs text-gray-500">Working…</p> : null}
    </section>
  );
}
