"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Phone, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { crmMoveLeadStageAction } from "@/lib/actions/fi-crm-actions";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import type { CrmKanbanLeadCard } from "@/src/lib/crm/types";
import type { CrmShellLeadListItem } from "@/src/lib/crm/types";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import { canMutateClinicFromOperatorContext } from "@/src/lib/crm/crmGatePolicy";
import { FI_CRM_KANBAN_REFRESH_EVENT } from "@/src/lib/calendar/quickCallInConstants";
import { useCrmLeadSlideOver } from "./LeadSlideOver";
import { CrmKanbanColumn } from "./CrmKanbanColumn";
import { CrmLeadKanbanCard } from "./CrmLeadKanbanCard";
import { QuickCallInBookingModal } from "@/src/components/fi/appointments/QuickCallInBookingModal";

function mapStageRef(s: FiCrmPipelineStageRow): NonNullable<CrmShellLeadListItem["stage"]> {
  return { id: s.id, slug: s.slug, label: s.label, sort_order: s.sort_order };
}

export function CrmKanbanBoard({
  tenantId,
  stages,
  initialCards,
  total,
  truncated,
  clinics = [],
}: {
  tenantId: string;
  stages: FiCrmPipelineStageRow[];
  initialCards: CrmKanbanLeadCard[];
  total: number;
  truncated: boolean;
  clinics?: CrmShellClinicOption[];
}) {
  const router = useRouter();
  const { openLead, operatorFiUserId, userRole, canUseClinicFeatures } = useCrmLeadSlideOver();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<CrmKanbanLeadCard[]>(initialCards);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [callInOpen, setCallInOpen] = useState(false);

  const canMutate = canMutateClinicFromOperatorContext({ userRole, canUseClinicFeatures });

  const syncFromServer = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    setCards(initialCards);
    setBannerError(null);
  }, [initialCards]);

  useEffect(() => {
    const onRefresh = () => syncFromServer();
    window.addEventListener(FI_CRM_KANBAN_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FI_CRM_KANBAN_REFRESH_EVENT, onRefresh);
  }, [syncFromServer]);

  const unassigned = useMemo(() => cards.filter((c) => !c.lead.current_stage_id), [cards]);

  const handleMove = useCallback(
    async (leadId: string, toStageId: string) => {
      const stageRow = stages.find((s) => s.id === toStageId);
      if (!stageRow) {
        setBannerError("Stage not found.");
        return;
      }

      const moving = cards.find((c) => c.lead.id === leadId);
      if (!moving || moving.lead.current_stage_id === toStageId) return;

      const snapshot = cards;
      setBannerError(null);
      setCards((cur) =>
        cur.map((c) =>
          c.lead.id === leadId
            ? {
                ...c,
                lead: { ...c.lead, current_stage_id: toStageId },
                stage: mapStageRef(stageRow),
                daysInStage: 0,
                stageEnteredAtIso: new Date().toISOString(),
              }
            : c
        )
      );

      const r = await crmMoveLeadStageAction(tenantId, leadId, {
        toStageId,
        changedBy: operatorFiUserId,
        source: "fi_admin_kanban",
      });

      if (!r.ok) {
        setCards(snapshot);
        setBannerError(r.error);
        return;
      }

      setCards((cur) =>
        cur.map((c) =>
          c.lead.id === leadId
            ? {
                ...c,
                lead: r.lead,
                stage: mapStageRef(stageRow),
                daysInStage: 0,
                stageEnteredAtIso: new Date().toISOString(),
              }
            : c
        )
      );
    },
    [cards, operatorFiUserId, stages, tenantId]
  );

  const onColumnDragOver = (stageId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropStageId(stageId);
  };

  const onColumnDrop =
    (stageId: string) =>
    (e: React.DragEvent): void => {
      e.preventDefault();
      setDropStageId(null);
      const leadId = e.dataTransfer.getData("text/lead-id");
      if (!leadId) return;
      void handleMove(leadId, stageId);
    };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Showing <strong>{cards.length}</strong> of <strong>{total}</strong> matching leads
          {truncated ? <span className="text-amber-700"> (board cap reached — narrow filters)</span> : null}.
        </p>
        <div className="flex items-center gap-2">
          {canMutate ? (
            <button
              type="button"
              onClick={() => setCallInOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              New call-in booking
            </button>
          ) : null}
          <button
            type="button"
            disabled={isPending}
            onClick={() => syncFromServer()}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {!canMutate ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your role can view the board but not move cards. Ask an FI admin or CRM operator to update stages.
        </p>
      ) : null}

      <AnimatePresence>
        {bannerError ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {bannerError}
            <button type="button" className="ml-2 underline" onClick={() => setBannerError(null)}>
              Dismiss
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
        {stages.map((stage) => {
          const colCards = cards.filter((c) => c.lead.current_stage_id === stage.id);
          const active = dropStageId === stage.id;
          return (
            <CrmKanbanColumn
              key={stage.id}
              title={stage.label}
              count={colCards.length}
              isDropActive={active}
              onDragOver={onColumnDragOver(stage.id)}
              onDragLeave={() => setDropStageId((v) => (v === stage.id ? null : v))}
              onDrop={onColumnDrop(stage.id)}
            >
              {colCards.map((c) => (
                <CrmLeadKanbanCard
                  key={c.lead.id}
                  tenantId={tenantId}
                  card={c}
                  stages={stages}
                  canMutate={canMutate}
                  onRequestMove={handleMove}
                  disabled={isPending}
                  onOpenPreview={openLead}
                />
              ))}
              {colCards.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">Drop leads here</p>
              ) : null}
            </CrmKanbanColumn>
          );
        })}

        {unassigned.length > 0 ? (
          <CrmKanbanColumn
            title="No stage"
            count={unassigned.length}
            isDropActive={false}
            onDragOver={() => {}}
            onDragLeave={() => {}}
            onDrop={(e) => e.preventDefault()}
          >
            {unassigned.map((c) => (
              <CrmLeadKanbanCard
                key={c.lead.id}
                tenantId={tenantId}
                card={c}
                stages={stages}
                canMutate={canMutate}
                onRequestMove={handleMove}
                disabled={isPending}
                onOpenPreview={openLead}
              />
            ))}
            <p className="text-[11px] text-gray-500">Assign a pipeline stage from the lead detail page.</p>
          </CrmKanbanColumn>
        ) : null}
      </div>

      <QuickCallInBookingModal
        tenantId={tenantId}
        open={callInOpen}
        onClose={() => setCallInOpen(false)}
        clinics={clinics}
        clinicalStaffOptions={[]}
      />
    </div>
  );
}
