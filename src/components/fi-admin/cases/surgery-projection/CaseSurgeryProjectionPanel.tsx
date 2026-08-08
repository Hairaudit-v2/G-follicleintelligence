"use client";

import { useMemo, useState, useTransition } from "react";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { CaseImageListItem } from "@/src/lib/cases/caseLoaders";
import type { HairlineDesignRow } from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import { buildAllocationMapViewModel } from "@/src/lib/cases/surgeryProjection/allocationMapModel";
import { evaluateSurgeryProjectionReadiness } from "@/src/lib/cases/surgeryProjection/readiness";
import {
  HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION,
  externalProjectionDisplayLabel,
} from "@/src/lib/imaging-os/sharedProjection/externalAssetPolicy";
import { ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER } from "@follicle/projection-core/client";
import { AllocationMapTab } from "./AllocationMapTab";
import { HairlineDesignTab } from "./HairlineDesignTab";
import { ProjectedOutcomeTab } from "./ProjectedOutcomeTab";
import { SurgeryProjectionReviewDrawer } from "./SurgeryProjectionReviewDrawer";

type TabId = "allocation" | "hairline" | "outcome";

export function CaseSurgeryProjectionPanel({
  tenantId,
  caseId,
  plan,
  hairlineDesigns,
  images,
  patientSubjectRef,
  actorUserId,
}: {
  tenantId: string;
  caseId: string;
  plan: CaseSurgeryPlanRow | null;
  hairlineDesigns: HairlineDesignRow[];
  images: CaseImageListItem[];
  patientSubjectRef: string | null;
  actorUserId: string | null;
}) {
  const [tab, setTab] = useState<TabId>("allocation");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const approvedHairline = hairlineDesigns.find((d) => d.status === "approved") ?? null;
  const editableHairline =
    hairlineDesigns.find((d) => d.status === "draft" || d.status === "awaiting_review") ??
    approvedHairline;

  const readiness = useMemo(
    () =>
      evaluateSurgeryProjectionReadiness({
        plan,
        approvedHairline,
        zones: plan?.planned_zones ?? [],
      }),
    [plan, approvedHairline]
  );

  const allocationModel = useMemo(
    () =>
      buildAllocationMapViewModel({
        planId: plan?.id ?? null,
        planningStatus: plan?.planning_status ?? null,
        planUpdatedAt: plan?.updated_at ?? null,
        zones: plan?.planned_zones ?? [],
        estimatedGraftsMin: plan?.estimated_grafts_min ?? null,
        estimatedGraftsMax: plan?.estimated_grafts_max ?? null,
        sourceImageRef: editableHairline?.sourceImageRef ?? images[0]?.storage_path ?? null,
      }),
    [plan, editableHairline, images]
  );

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "allocation", label: "Allocation Map" },
    { id: "hairline", label: "Hairline Design" },
    { id: "outcome", label: "Projected Outcome" },
  ];

  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Surgery projections</h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Clinical planning artifacts and readiness for illustrative projected outcomes. Patient
            sharing is unavailable in this foundation stage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.04]"
        >
          Review / correction
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1 border-b border-white/[0.06] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-xs ${
              tab === t.id
                ? "bg-white/[0.08] text-slate-100"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "allocation" ? <AllocationMapTab model={allocationModel} /> : null}
        {tab === "hairline" ? (
          <HairlineDesignTab
            tenantId={tenantId}
            caseId={caseId}
            plan={plan}
            design={editableHairline}
            designs={hairlineDesigns}
            images={images}
            actorUserId={actorUserId}
            pending={pending}
            startTransition={startTransition}
          />
        ) : null}
        {tab === "outcome" ? (
          <ProjectedOutcomeTab
            readiness={readiness}
            patientSubjectRef={patientSubjectRef}
            externalInspection={HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION}
            externalLabel={externalProjectionDisplayLabel({
              fiosSubjectMappingVerified:
                HAIRAUDIT_OPENAI_PILOT_ASSET_INSPECTION.fiosSubjectMappingVerified,
            })}
            disclaimer={ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER}
            tenantId={tenantId}
            caseId={caseId}
            actorUserId={actorUserId}
            actorRole={null}
            sharedOutcome={null}
          />
        ) : null}
      </div>

      <SurgeryProjectionReviewDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        readiness={readiness}
        allocationModel={allocationModel}
        approvedHairline={approvedHairline}
      />
    </div>
  );
}
