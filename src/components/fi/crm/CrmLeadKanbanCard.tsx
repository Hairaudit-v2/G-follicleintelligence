"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
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

const LONG_PRESS_MS = 520;

export function CrmLeadKanbanCard({
  tenantId,
  card,
  stages,
  canMutate,
  onRequestMove,
  disabled,
  onOpenPreview,
}: {
  tenantId: string;
  card: CrmKanbanLeadCard;
  stages: FiCrmPipelineStageRow[];
  canMutate: boolean;
  onRequestMove: (leadId: string, toStageId: string) => void;
  disabled: boolean;
  onOpenPreview?: (leadId: string) => void;
}) {
  const router = useRouter();
  const href = `/fi-admin/${tenantId}/crm/leads/${card.lead.id}`;
  const name = card.person ? personMetadataDisplayLabel(card.person.metadata) : "—";
  const nwShort = getNorwoodShortLabel(card.norwoodScale);
  const subtitle = card.primaryConcernLine ?? card.clinicalSummaryLine ?? card.lead.summary?.trim() ?? null;
  const ownerLabel = card.owner?.email ?? card.lead.primary_owner_user_id?.slice(0, 8) ?? "—";

  const longPressArmed = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/lead-id", card.lead.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function openFullPage() {
    router.push(href);
  }

  function handleMainPointerDown() {
    if (!onOpenPreview || disabled) return;
    longPressArmed.current = false;
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      longPressArmed.current = true;
      openFullPage();
    }, LONG_PRESS_MS);
  }

  function handleMainPointerUpCancel() {
    clearLongPressTimer();
  }

  function handleMainClick(e: React.MouseEvent) {
    if (!onOpenPreview || disabled) return;
    if (longPressArmed.current) {
      longPressArmed.current = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    e.preventDefault();
    onOpenPreview(card.lead.id);
  }

  function handleAuxClick(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  const mainInteractive = Boolean(onOpenPreview) && !disabled;

  return (
    <motion.div layout layoutId={`kanban-${card.lead.id}`} className="touch-manipulation">
      <div
        className={`rounded-lg border bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40 ${
          card.isHighValue ? "border-amber-300 ring-1 ring-amber-100" : "border-white/[0.08]"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <div className="flex items-stretch gap-0">
          {canMutate ? (
            <button
              type="button"
              data-kanban-interactive
              draggable
              onDragStart={onDragStart}
              disabled={disabled}
              className="flex w-7 shrink-0 cursor-grab items-center justify-center border-r border-white/[0.06] bg-white/[0.03] text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed"
              aria-label="Drag to change stage"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <div
            className={`min-w-0 flex-1 p-2.5 ${mainInteractive ? "cursor-pointer" : ""}`}
            role={mainInteractive ? "button" : undefined}
            tabIndex={mainInteractive ? 0 : undefined}
            onPointerDown={handleMainPointerDown}
            onPointerUp={handleMainPointerUpCancel}
            onPointerLeave={handleMainPointerUpCancel}
            onPointerCancel={handleMainPointerUpCancel}
            onClick={handleMainClick}
            onAuxClick={handleAuxClick}
            onKeyDown={(e) => {
              if (!mainInteractive || !onOpenPreview) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenPreview(card.lead.id);
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {onOpenPreview ? (
                  <span className="block font-medium text-blue-700">{name}</span>
                ) : (
                  <Link href={href} className="block font-medium text-blue-700 hover:underline">
                    {name}
                  </Link>
                )}
                <p className="truncate text-xs text-gray-500">{leadTitleFromRow(card.lead.summary, card.lead.id)}</p>
              </div>
              {nwShort ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                  title={card.norwoodScale ?? undefined}
                >
                  <Activity className="h-3 w-3" aria-hidden />
                  {nwShort}
                </span>
              ) : null}
            </div>
            {subtitle ? <p className="mt-1 line-clamp-2 text-xs text-slate-300">{subtitle}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span title="Last activity (lead update or CRM timeline)">Act: {fmtRelative(card.lastActivityAtIso)}</span>
              {card.daysInStage != null ? (
                <span className="rounded bg-white/[0.06] px-1 py-0.5 text-slate-300">{card.daysInStage}d in stage</span>
              ) : null}
              {card.overdueTaskCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-300">
                  <AlertCircle className="h-3 w-3" aria-hidden />
                  {card.overdueTaskCount} overdue
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[11px] text-gray-500">Owner: {ownerLabel}</p>
          </div>
          {canMutate ? (
            <div className="flex shrink-0 flex-col border-l border-white/[0.06]" data-kanban-interactive>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex h-9 w-9 items-center justify-center text-gray-500 hover:bg-white/[0.03] hover:text-slate-200 disabled:opacity-50"
                    aria-label="Move lead or open actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  <DropdownMenuItem asChild className="cursor-pointer text-sm">
                    <Link href={href}>Open full page</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
