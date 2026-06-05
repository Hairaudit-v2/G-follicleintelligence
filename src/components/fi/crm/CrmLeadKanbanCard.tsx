"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, AlertCircle, GripVertical, MoreHorizontal } from "lucide-react";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import type { CrmKanbanLeadCard } from "@/src/lib/crm/types";
import { getNorwoodShortLabel } from "@/src/lib/patients/hairLossScales";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function CrmLeadKanbanCard({
  tenantId,
  card,
  stages,
  canMutate,
  onRequestMove,
  disabled,
}: {
  tenantId: string;
  card: CrmKanbanLeadCard;
  stages: FiCrmPipelineStageRow[];
  canMutate: boolean;
  onRequestMove: (leadId: string, toStageId: string) => void;
  disabled: boolean;
}) {
  const href = `/fi-admin/${tenantId}/crm/leads/${card.lead.id}`;
  const name = card.person ? personMetadataDisplayLabel(card.person.metadata) : "—";
  const nwShort = getNorwoodShortLabel(card.norwoodScale);
  const subtitle = card.primaryConcernLine ?? card.clinicalSummaryLine ?? card.lead.summary?.trim() ?? null;
  const ownerLabel = card.owner?.email ?? card.lead.primary_owner_user_id?.slice(0, 8) ?? "—";

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/lead-id", card.lead.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <motion.div layout layoutId={`kanban-${card.lead.id}`} className="touch-manipulation">
      <div
        className={`rounded-lg border bg-white shadow-sm ${
          card.isHighValue ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-200"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <div className="flex items-stretch gap-0">
          {canMutate ? (
            <button
              type="button"
              draggable
              onDragStart={onDragStart}
              disabled={disabled}
              className="flex w-7 shrink-0 cursor-grab items-center justify-center border-r border-gray-100 bg-gray-50 text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed"
              aria-label="Drag to change stage"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link href={href} className="block font-medium text-blue-700 hover:underline">
                  {name}
                </Link>
                <p className="truncate text-xs text-gray-500">{leadTitleFromRow(card.lead.summary, card.lead.id)}</p>
              </div>
              {nwShort ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700"
                  title={card.norwoodScale ?? undefined}
                >
                  <Activity className="h-3 w-3" aria-hidden />
                  {nwShort}
                </span>
              ) : null}
            </div>
            {subtitle ? <p className="mt-1 line-clamp-2 text-xs text-gray-700">{subtitle}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600">
              <span title="Last activity (lead update or CRM timeline)">Act: {fmtRelative(card.lastActivityAtIso)}</span>
              {card.daysInStage != null ? (
                <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-700">{card.daysInStage}d in stage</span>
              ) : null}
              {card.overdueTaskCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  {card.overdueTaskCount} overdue
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-gray-500">Owner: {ownerLabel}</p>
          </div>
          {canMutate ? (
            <div className="flex shrink-0 flex-col border-l border-gray-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex h-9 w-9 items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
                    aria-label="Move lead or open actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {stages.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      disabled={s.id === card.lead.current_stage_id || disabled}
                      className="cursor-pointer text-sm"
                      onClick={() => onRequestMove(card.lead.id, s.id)}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
