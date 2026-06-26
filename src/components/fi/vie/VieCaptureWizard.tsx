"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";

import { inferCaptureDeviceType } from "@/src/lib/imagingOs/imagingOsConstants";
import { buildGuidedImageUploadFields } from "@/src/lib/imagingOs/imagingOsGuidedFields";
import {
  defaultSlotInstruction,
  nextRecommendedSlotSlug,
  parseProgressMeta,
  slotIsSatisfied,
  type ProtocolSlotDef,
} from "@/src/lib/imagingOs/imagingOsProtocol";
import { getVieProtocol, groupSurgeryDaySlotsByPhase } from "@/src/lib/vie/vieProtocolCatalog";
import type { VieProtocolSlug } from "@/src/lib/vie/vieProtocolTypes";
import type {
  VieCaptureFraming,
  VieCaptureGuideKind,
  VieCaptureReviewPayload,
  VieProtocolSlotDef,
  VieSlotTier,
} from "@/src/lib/vie/vieProtocolTypes";
import { VieCaptureGuideOverlay } from "./VieCaptureGuideOverlay";
import { VieIntelligenceResultPanel } from "./VieIntelligenceResultPanel";

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

type SlotProgress = Record<string, unknown>;

type GuidedApi = {
  completionPercent: number;
  sessionCompleted: boolean;
  nextSlotSlug: string | null;
};

type WizardSlot = ProtocolSlotDef & {
  slot_tier: VieSlotTier;
  capture_distance_hint: string;
  framing: VieCaptureFraming;
  suggested_timing?: string;
};

function parseSlotProgress(raw: SlotProgress, slots: ProtocolSlotDef[]) {
  const required = slots.filter((s) => s.required !== false);
  const complete = required.filter((s) => slotIsSatisfied(s, raw)).length;
  return { requiredComplete: complete, requiredTotal: required.length };
}

function captureGuideForSlot(templateSlug: string, slotSlug: string): VieCaptureGuideKind {
  const protocol = getVieProtocol(templateSlug);
  const slot = protocol?.slots.find((s) => s.slug === slotSlug);
  return slot?.capture_guide ?? "front_hairline";
}

function slotTierLabel(tier: VieSlotTier): string {
  if (tier === "addon") return "Required add-on";
  if (tier === "optional") return "Optional";
  return "Required";
}

function slotCaption(slot: WizardSlot, requiredComplete: number, requiredTotal: number): string {
  if (slot.required === false) return "Optional view — skipping does not affect protocol completeness";
  if (slot.slot_tier === "addon") return "Required add-on view";
  return `Required primary view · ${Math.min(requiredComplete + 1, requiredTotal)} of ${requiredTotal}`;
}

function wizardSlotFromDef(s: VieProtocolSlotDef): WizardSlot {
  return {
    slug: s.slug,
    label: s.label,
    required: s.required,
    slot_tier: s.slot_tier,
    suggested_region: s.suggested_region,
    instruction: s.instruction,
    capture_distance_hint: s.capture_distance_hint,
    framing: s.framing,
    suggested_timing: s.suggested_timing,
  };
}

function groupSlots(slots: WizardSlot[]) {
  return {
    primary: slots.filter(
      (s) => s.slot_tier === "primary" || (s.required !== false && s.slot_tier !== "addon" && s.slot_tier !== "optional")
    ),
    addon: slots.filter((s) => s.slot_tier === "addon"),
    optional: slots.filter((s) => s.required === false || s.slot_tier === "optional"),
  };
}

function pendingForSlot(progress: SlotProgress, slotSlug: string): boolean {
  return Boolean(parseProgressMeta(progress).vie_pending?.[slotSlug]);
}

function SlotChecklist({
  title,
  slots,
  progress,
  currentSlug,
}: {
  title: string;
  slots: WizardSlot[];
  progress: SlotProgress;
  currentSlug: string | null;
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {slots.map((s) => {
          const done = slotIsSatisfied(s, progress);
          const pending = pendingForSlot(progress, s.slug);
          const active = s.slug === currentSlug;
          return (
            <li
              key={s.slug}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${active ? "bg-cyan-50 text-cyan-900" : "text-gray-600"}`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : pending ? (
                <Circle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              )}
              <span>
                {s.label}
                {pending ? " · review pending" : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function VieCaptureWizard({
  tenantId,
  patientId,
  sessionId,
  templateSlug,
  initialProgress = {},
  onClose,
}: {
  tenantId: string;
  patientId: string;
  sessionId: string;
  templateSlug: VieProtocolSlug;
  initialProgress?: SlotProgress;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<SlotProgress>(initialProgress);
  const [slotOverride, setSlotOverride] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [captureReview, setCaptureReview] = useState<VieCaptureReviewPayload | null>(null);
  const [reviewSlotSlug, setReviewSlotSlug] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const protocol = useMemo(() => getVieProtocol(templateSlug), [templateSlug]);
  const slots = useMemo(
    (): WizardSlot[] =>
      (protocol?.slots ?? []).map((s: VieProtocolSlotDef) => wizardSlotFromDef(s)),
    [protocol]
  );

  const grouped = useMemo(() => groupSlots(slots), [slots]);
  const surgeryPhaseGroups = useMemo(
    () => (templateSlug === "surgery_day" && protocol ? groupSurgeryDaySlotsByPhase(protocol.slots) : []),
    [protocol, templateSlug]
  );
  const meta = useMemo(() => parseProgressMeta(progress), [progress]);
  const computedNext = useMemo(() => nextRecommendedSlotSlug(slots, progress), [slots, progress]);
  const pendingSlotSlug = Object.keys(meta.vie_pending ?? {})[0] ?? null;
  const currentSlug = captureReview
    ? reviewSlotSlug
    : pendingSlotSlug ?? slotOverride ?? computedNext ?? slots[0]?.slug ?? null;
  const currentSlot = slots.find((s) => s.slug === currentSlug) ?? null;
  const { requiredComplete, requiredTotal } = parseSlotProgress(progress, slots);
  const optionalTotal = slots.filter((s) => s.required === false).length;
  const optionalComplete = slots.filter((s) => s.required === false && slotIsSatisfied(s, progress)).length;
  const captureGuide = currentSlug ? captureGuideForSlot(templateSlug, currentSlug) : "front_hairline";
  const awaitingReview = Boolean(captureReview && reviewSlotSlug);

  useEffect(() => {
    setProgress(initialProgress);
  }, [initialProgress]);

  const syncProgressFromServer = useCallback((nextProgress: SlotProgress, g?: GuidedApi) => {
    setProgress(nextProgress);
    if (g?.sessionCompleted) setSessionCompleted(true);
    if (g?.nextSlotSlug && !Object.keys(parseProgressMeta(nextProgress).vie_pending ?? {}).length) {
      setSlotOverride(g.nextSlotSlug);
    }
  }, []);

  const acceptCapture = useCallback(
    (qualityOverride = false) => {
      if (!reviewSlotSlug) return;
      setErr(null);
      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/vie/capture/accept`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: sessionId,
                slot_slug: reviewSlotSlug,
                quality_override: qualityOverride,
              }),
            }
          );
          const j = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            guided_session?: GuidedApi;
          };
          if (!res.ok || !j.ok) {
            setErr(j.error ?? `Accept failed (${res.status}).`);
            return;
          }

          const imageId =
            captureReview?.patient_image_id ?? meta.vie_pending?.[reviewSlotSlug]?.patient_image_id ?? null;
          const clearedMeta = { ...parseProgressMeta(progress) };
          const pendingMap = { ...(clearedMeta.vie_pending ?? {}) };
          delete pendingMap[reviewSlotSlug];
          clearedMeta.vie_pending = Object.keys(pendingMap).length > 0 ? pendingMap : undefined;
          const nextProgress: SlotProgress = { ...progress, __meta__: clearedMeta };
          if (imageId) nextProgress[reviewSlotSlug] = [imageId];

          setCaptureReview(null);
          setReviewSlotSlug(null);
          syncProgressFromServer(nextProgress, j.guided_session);
          router.refresh();
        } catch {
          setErr("Network error during accept.");
        }
      });
    },
    [captureReview?.patient_image_id, meta.vie_pending, patientId, progress, reviewSlotSlug, router, sessionId, syncProgressFromServer, tenantId]
  );

  const retakeCapture = useCallback(() => {
    if (!reviewSlotSlug) return;
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/vie/capture/retake`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, slot_slug: reviewSlotSlug }),
          }
        );
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !j.ok) {
          setErr(j.error ?? `Retake failed (${res.status}).`);
          return;
        }

        const clearedMeta = { ...parseProgressMeta(progress) };
        const pendingMap = { ...(clearedMeta.vie_pending ?? {}) };
        delete pendingMap[reviewSlotSlug];
        clearedMeta.vie_pending = Object.keys(pendingMap).length > 0 ? pendingMap : undefined;
        const nextProgress = { ...progress, __meta__: clearedMeta };

        setCaptureReview(null);
        setReviewSlotSlug(null);
        setProgress(nextProgress);
        setSlotOverride(reviewSlotSlug);
        router.refresh();
        camRef.current?.click();
      } catch {
        setErr("Network error during retake.");
      }
    });
  }, [patientId, progress, reviewSlotSlug, router, sessionId, tenantId]);

  const uploadFile = useCallback(
    (file: File | null) => {
      if (!file || !currentSlug || !sessionId || awaitingReview) return;
      setErr(null);
      setCaptureReview(null);

      const fields = buildGuidedImageUploadFields({
        templateSlug,
        slotSlug: currentSlug,
        deviceType: inferCaptureDeviceType(typeof navigator !== "undefined" ? navigator.userAgent : ""),
        suggestedRegion: currentSlot?.suggested_region ?? null,
      });

      const hasAccepted = slotIsSatisfied(currentSlot!, progress);
      const hasPending = pendingForSlot(progress, currentSlug);

      startTransition(async () => {
        try {
          const dims = await readImageDimensions(file);
          const fd = new FormData();
          fd.set("file", file);
          fd.set("image_category", "scalp");
          fd.set("protocol_session_id", sessionId);
          fd.set("imaging_library_axis", fields.imaging_library_axis);
          fd.set("visit_type", fields.visit_type);
          fd.set("imaging_protocol_template_slug", fields.imaging_protocol_template_slug);
          fd.set("imaging_protocol_slot_slug", fields.imaging_protocol_slot_slug);
          if (fields.anatomical_region) fd.set("anatomical_region", fields.anatomical_region);
          fd.set("device_type", fields.device_type);
          fd.set("capture_type", "camera");
          fd.set("capture_source", "vie_capture_wizard");
          if (dims.width) fd.set("image_width", String(dims.width));
          if (dims.height) fd.set("image_height", String(dims.height));
          if (hasAccepted || hasPending) fd.set("guided_replace", "1");

          const res = await fetch(
            `/api/tenants/${encodeURIComponent(tenantId)}/patients/${encodeURIComponent(patientId)}/images`,
            { method: "POST", body: fd, credentials: "include" }
          );
          const j = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            vie_capture_review?: VieCaptureReviewPayload;
            attribution?: { quality?: { alert_message?: string | null } };
          };
          if (!res.ok || !j.ok) {
            setErr(j.error ?? `Capture failed (${res.status}).`);
            return;
          }

          const qualityAlert = j.attribution?.quality?.alert_message;
          if (qualityAlert) {
            setErr(qualityAlert);
            return;
          }

          if (j.vie_capture_review) {
            setCaptureReview(j.vie_capture_review);
            setReviewSlotSlug(currentSlug);
            const pendingMeta = { ...parseProgressMeta(progress) };
            const pendingMap = { ...(pendingMeta.vie_pending ?? {}) };
            pendingMap[currentSlug] = {
              patient_image_id: j.vie_capture_review.patient_image_id,
              intelligence_id: j.vie_capture_review.intelligence_id ?? null,
              captured_at: new Date().toISOString(),
              quality_score: j.vie_capture_review.quality_score,
              quality_band: j.vie_capture_review.quality_band,
              clinically_usable: j.vie_capture_review.clinical_usability.clinically_usable,
            };
            pendingMeta.vie_pending = pendingMap;
            setProgress({ ...progress, __meta__: pendingMeta });
          }

          router.refresh();
          if (camRef.current) camRef.current.value = "";
        } catch {
          setErr("Network error during capture.");
        }
      });
    },
    [awaitingReview, currentSlot, currentSlug, patientId, progress, router, sessionId, templateSlug, tenantId]
  );

  if (!protocol || !currentSlot) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Protocol configuration not found.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Visual Intelligence Engine</p>
          <h3 className="text-base font-semibold text-gray-900">{protocol.name}</h3>
          <p className="mt-1 text-xs text-gray-600">
            Required: {requiredComplete}/{requiredTotal} accepted
            {optionalTotal > 0 ? ` · Optional: ${optionalComplete}/${optionalTotal}` : null}
            {sessionCompleted ? " — protocol complete" : null}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
          Close
        </button>
      </div>

      {!awaitingReview ? (
        <div className="rounded-lg border border-gray-200 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="text-center text-sm font-semibold text-white">{currentSlot.label}</p>
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-cyan-200">
              {slotTierLabel(currentSlot.slot_tier)}
            </span>
          </div>
          <p className="mt-1 text-center text-xs text-slate-400">
            {slotCaption(currentSlot, requiredComplete, requiredTotal)}
          </p>
          <p className="mt-1 text-center text-[0.65rem] text-slate-500">
            {currentSlot.framing === "close_up" ? "Close-up" : "Overview"} · {currentSlot.capture_distance_hint}
            {currentSlot.suggested_timing ? ` · ${currentSlot.suggested_timing}` : null}
          </p>
          <div className="mt-4">
            <VieCaptureGuideOverlay guide={captureGuide} />
          </div>
          <p className="mt-4 text-sm text-slate-300">{defaultSlotInstruction(currentSlot)}</p>
        </div>
      ) : null}

      {captureReview ? (
        <VieIntelligenceResultPanel
          review={captureReview}
          pending={pending}
          onAccept={() => acceptCapture(false)}
          onRetake={retakeCapture}
          onOverrideAccept={
            captureReview.policy.allow_quality_override ? () => acceptCapture(true) : undefined
          }
        />
      ) : null}

      <div className="space-y-3">
        {surgeryPhaseGroups.length > 0 ? (
          surgeryPhaseGroups.map((phaseGroup) => (
            <SlotChecklist
              key={phaseGroup.phase}
              title={phaseGroup.label}
              slots={phaseGroup.slots.map((s) => wizardSlotFromDef(s))}
              progress={progress}
              currentSlug={currentSlug}
            />
          ))
        ) : (
          <>
            <SlotChecklist
              title="Required primary views"
              slots={grouped.primary}
              progress={progress}
              currentSlug={currentSlug}
            />
            <SlotChecklist
              title="Required add-on views (donor)"
              slots={grouped.addon}
              progress={progress}
              currentSlug={currentSlug}
            />
            <SlotChecklist title="Optional views" slots={grouped.optional} progress={progress} currentSlug={currentSlug} />
          </>
        )}
      </div>

      {!awaitingReview ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => camRef.current?.click()}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            <Camera className="h-4 w-4 shrink-0" aria-hidden />
            Capture {currentSlot.label}
          </button>
          <input
            ref={camRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            capture="environment"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files?.[0] ?? null)}
          />
        </>
      ) : null}

      {pending ? <p className="text-sm text-gray-600">Processing capture…</p> : null}
      {err ? (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
