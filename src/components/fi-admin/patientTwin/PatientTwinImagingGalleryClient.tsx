"use client";

import { useMemo, useState, useTransition } from "react";

import {
  classifyPatientImageAction,
  updatePatientImageClassificationReviewAction,
} from "@/src/lib/actions/fi-image-ai-actions";
import {
  FI_AI_HAIR_STATES,
  FI_AI_IMAGE_CATEGORIES,
  FI_AI_IMAGE_REVIEW_STATUSES,
  FI_AI_SHAVE_STATES,
  FI_AI_SURGERY_STAGES,
} from "@/src/lib/imaging/aiImageClassificationTypes";
import type {
  PatientTwinImagingGalleryItem,
  PatientTwinImagingGalleryUiSection,
} from "@/src/lib/patientTwin/patientTwinTypes";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{children}</p>
  );
}

function SelectRow(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <FieldLabel>{props.label}</FieldLabel>
      <select
        className="mt-1 w-full rounded-md border border-white/10 bg-[#0f172a] px-2 py-1.5 text-xs text-slate-100"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PatientTwinImagingGalleryClient(props: {
  tenantId: string;
  patientId: string;
  uiSections: PatientTwinImagingGalleryUiSection[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sections = useMemo(
    () => props.uiSections.filter((s) => s.items.length > 0),
    [props.uiSections]
  );

  return (
    <div className="mt-4 space-y-6">
      {message ? <p className="text-xs text-amber-200/90">{message}</p> : null}
      {sections.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">
          No gallery groups yet — upload clinical images, then run AI analysis.
        </p>
      ) : (
        sections.map((section) => (
          <div key={section.key}>
            <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((img) => (
                <TwinImagingImageCard
                  key={img.id}
                  tenantId={props.tenantId}
                  patientId={props.patientId}
                  img={img}
                  pending={pending}
                  start={start}
                  setMessage={setMessage}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function TwinImagingImageCard(props: {
  tenantId: string;
  patientId: string;
  img: PatientTwinImagingGalleryItem;
  pending: boolean;
  start: (cb: () => void) => void;
  setMessage: (m: string | null) => void;
}) {
  const { tenantId, patientId, img, pending, start, setMessage } = props;
  const [cat, setCat] = useState(img.ai_image_category ?? "unknown");
  const [hair, setHair] = useState(img.ai_hair_state ?? "unknown");
  const [shave, setShave] = useState(img.ai_shave_state ?? "unknown");
  const [surg, setSurg] = useState(img.ai_surgery_stage ?? "unknown");
  const [review, setReview] = useState(img.ai_image_review_status);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.thumbnail_url}
        alt=""
        className="aspect-square w-full rounded-md object-cover"
        loading="lazy"
      />
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
        <div>
          <FieldLabel>AI category</FieldLabel>
          <p className="mt-0.5 font-medium text-white">
            {(img.ai_image_category ?? "—").replace(/_/g, " ")}
          </p>
        </div>
        <div>
          <FieldLabel>Confidence</FieldLabel>
          <p className="mt-0.5 font-medium text-white">
            {img.ai_image_category_confidence != null
              ? img.ai_image_category_confidence.toFixed(2)
              : "—"}
          </p>
        </div>
        <div>
          <FieldLabel>Hair</FieldLabel>
          <p className="mt-0.5">{(img.ai_hair_state ?? "—").replace(/_/g, " ")}</p>
        </div>
        <div>
          <FieldLabel>Shave</FieldLabel>
          <p className="mt-0.5">{(img.ai_shave_state ?? "—").replace(/_/g, " ")}</p>
        </div>
        <div className="col-span-2">
          <FieldLabel>Surgery stage</FieldLabel>
          <p className="mt-0.5">{(img.ai_surgery_stage ?? "—").replace(/_/g, " ")}</p>
        </div>
        <div className="col-span-2">
          <FieldLabel>Review</FieldLabel>
          <p className="mt-0.5">{img.ai_image_review_status.replace(/_/g, " ")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-cyan-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            start(async () => {
              const res = await classifyPatientImageAction(tenantId, patientId, img.id, {});
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Analyse image
        </button>
      </div>
      <div className="border-t border-white/10 pt-3">
        <p className="text-xs font-medium text-slate-300">Correct category</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <SelectRow
            label="Category"
            value={cat}
            onChange={setCat}
            options={FI_AI_IMAGE_CATEGORIES}
          />
          <SelectRow
            label="Hair state"
            value={hair}
            onChange={setHair}
            options={FI_AI_HAIR_STATES}
          />
          <SelectRow
            label="Shave state"
            value={shave}
            onChange={setShave}
            options={FI_AI_SHAVE_STATES}
          />
          <SelectRow
            label="Surgery stage"
            value={surg}
            onChange={setSurg}
            options={FI_AI_SURGERY_STAGES}
          />
          <SelectRow
            label="Review status"
            value={review}
            onChange={setReview}
            options={FI_AI_IMAGE_REVIEW_STATUSES}
          />
        </div>
        <button
          type="button"
          disabled={pending}
          className="mt-3 w-full rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            start(async () => {
              const res = await updatePatientImageClassificationReviewAction(
                tenantId,
                patientId,
                img.id,
                {
                  ai_image_category: cat as (typeof FI_AI_IMAGE_CATEGORIES)[number],
                  ai_hair_state: hair as (typeof FI_AI_HAIR_STATES)[number],
                  ai_shave_state: shave as (typeof FI_AI_SHAVE_STATES)[number],
                  ai_surgery_stage: surg as (typeof FI_AI_SURGERY_STAGES)[number],
                  ai_image_review_status: review as (typeof FI_AI_IMAGE_REVIEW_STATUSES)[number],
                }
              );
              if (!res.ok) setMessage(res.error);
            });
          }}
        >
          Save review
        </button>
      </div>
    </li>
  );
}
