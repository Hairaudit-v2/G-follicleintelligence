"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Scissors } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  addExtractionGraftCountAction,
  addImplantationGraftCountAction,
  correctGraftCountAction,
  enterTrayGraftCountAction,
  logDiscardedGraftsAction,
  reconcileGraftsAction,
} from "@/lib/actions/fi-surgery-os-actions";
import type { SurgeryOsViewerRole } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  resolveSurgeryOsStaffRoleCategory,
  surgeryOsGraftActionAllowed,
  type SurgeryOsAction,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";
import type {
  SurgeryOsGraftSummary,
  SurgeryOsLiveSurgery,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

type GraftModalKind =
  | "extraction"
  | "implantation"
  | "tray"
  | "discard"
  | "correct"
  | "reconcile"
  | null;

const GRAFT_ACTIONS: Array<{ key: GraftModalKind; label: string; action: SurgeryOsAction }> = [
  { key: "extraction", label: "Add extraction", action: "add_extraction_count" },
  { key: "implantation", label: "Add implantation", action: "add_implantation_count" },
  { key: "tray", label: "Tray count", action: "enter_tray_count" },
  { key: "discard", label: "Log discarded", action: "log_discarded_grafts" },
  { key: "correct", label: "Correct count", action: "correct_graft_count" },
  { key: "reconcile", label: "Reconcile", action: "reconcile_grafts" },
];

export function SurgeryOsGraftActions({
  tenantId,
  viewerRole,
  staffRole,
  surgeries,
  graftSummary,
  onMutated,
}: {
  tenantId: string;
  viewerRole: SurgeryOsViewerRole;
  staffRole: string | null;
  surgeries: SurgeryOsLiveSurgery[];
  graftSummary: SurgeryOsGraftSummary[];
  onMutated: () => void;
}) {
  const staffCategory = resolveSurgeryOsStaffRoleCategory(staffRole);
  const ctx = useMemo(
    () => ({
      viewerRole,
      staffRoleCategory: staffCategory,
      actorFiUserId: null,
    }),
    [viewerRole, staffCategory],
  );

  const allowedActions = GRAFT_ACTIONS.filter((a) => surgeryOsGraftActionAllowed(ctx, a.action));

  const primaryGraftKeys = new Set<GraftModalKind>(["extraction", "implantation", "reconcile"]);
  const primaryActions = allowedActions.filter((a) => a.key && primaryGraftKeys.has(a.key));
  const secondaryActions = allowedActions.filter((a) => a.key && !primaryGraftKeys.has(a.key));

  const [surgeryId, setSurgeryId] = useState(surgeries[0]?.id ?? "");
  const [modal, setModal] = useState<GraftModalKind>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!allowedActions.length || surgeries.length === 0) return null;

  const effectiveSurgeryId = surgeryId || surgeries[0]?.id || "";
  const selectedGraft = graftSummary.find((g) => g.surgeryId === effectiveSurgeryId);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Graft action failed.");
        return;
      }
      setModal(null);
      onMutated();
    });
  }

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Scissors className="h-4 w-4 text-violet-400" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-400/90">Graft capture</span>
        <select
          value={effectiveSurgeryId}
          onChange={(e) => setSurgeryId(e.target.value)}
          className={cn(fiOsChromeClasses.toolbarControlSurface, "px-2 py-1.5 text-xs text-slate-200")}
        >
          {surgeries.map((s) => (
            <option key={s.id} value={s.id}>
              {s.patientLabel}
            </option>
          ))}
        </select>
        {primaryActions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setModal(a.key)}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "px-2.5 py-1.5 text-xs font-semibold text-violet-100",
            )}
          >
            {a.label}
          </button>
        ))}
        {secondaryActions.length ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSecondary((v) => !v)}
              className={cn(fiOsChromeClasses.toolbarControlSurface, "px-2.5 py-1.5 text-xs font-semibold text-slate-400")}
            >
              More graft tools
            </button>
            {showSecondary ? (
              <div className="absolute left-0 top-full z-20 mt-1 flex min-w-[10rem] flex-col gap-1 rounded-lg border border-white/[0.1] bg-[#0c1220] p-1 shadow-lg">
                {secondaryActions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => {
                      setShowSecondary(false);
                      setModal(a.key);
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-slate-100"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden /> : null}
      </div>
      {selectedGraft ? (
        <p className="mt-2 text-xs text-slate-500">
          Current: {selectedGraft.extractedGrafts} extracted · {selectedGraft.implantedGrafts} implanted ·{" "}
          {selectedGraft.remainingGrafts} remaining
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}

      {modal === "extraction" ? (
        <CountModal
          title="Add extraction count"
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(count, note) =>
            run(() =>
              addExtractionGraftCountAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                count,
                note,
              }),
            )
          }
        />
      ) : null}

      {modal === "implantation" ? (
        <CountModal
          title="Add implantation count"
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(count, note) =>
            run(() =>
              addImplantationGraftCountAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                count,
                note,
              }),
            )
          }
        />
      ) : null}

      {modal === "discard" ? (
        <CountModal
          title="Log discarded grafts"
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(count, note) =>
            run(() =>
              logDiscardedGraftsAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                count,
                note,
              }),
            )
          }
        />
      ) : null}

      {modal === "tray" ? (
        <TrayModal
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(values) =>
            run(() =>
              enterTrayGraftCountAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                ...values,
              }),
            )
          }
        />
      ) : null}

      {modal === "correct" ? (
        <CorrectModal
          initial={selectedGraft}
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(values) =>
            run(() =>
              correctGraftCountAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                ...values,
              }),
            )
          }
        />
      ) : null}

      {modal === "reconcile" ? (
        <ReconcileModal
          graft={selectedGraft}
          onClose={() => setModal(null)}
          pending={pending}
          onSubmit={(note) =>
            run(() =>
              reconcileGraftsAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                note,
              }),
            )
          }
        />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CountModal({
  title,
  pending,
  onClose,
  onSubmit,
}: {
  title: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (count: number, note: string | null) => void;
}) {
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");

  return (
    <ModalShell title={title} onClose={onClose}>
      <label className="block text-xs text-slate-500">
        Count
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <label className="mt-3 block text-xs text-slate-500">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending || !count || Number.parseInt(count, 10) <= 0}
        onClick={() => onSubmit(Number.parseInt(count, 10), note.trim() || null)}
        className={cn(fiOsChromeClasses.toolbarControlSurface, "mt-4 px-4 py-2 text-sm font-semibold text-violet-100")}
      >
        Save
      </button>
    </ModalShell>
  );
}

function TrayModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    singles: number;
    doubles: number;
    triples: number;
    multiples: number;
    total_hairs?: number | null;
    note?: string | null;
  }) => void;
}) {
  const [singles, setSingles] = useState("0");
  const [doubles, setDoubles] = useState("0");
  const [triples, setTriples] = useState("0");
  const [multiples, setMultiples] = useState("0");
  const [totalHairs, setTotalHairs] = useState("");
  const [note, setNote] = useState("");

  return (
    <ModalShell title="Enter tray count" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["Singles", singles, setSingles],
            ["Doubles", doubles, setDoubles],
            ["Triples", triples, setTriples],
            ["Multiples", multiples, setMultiples],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="block text-xs text-slate-500">
            {label}
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs text-slate-500">
        Total hairs (optional)
        <input
          type="number"
          min={0}
          value={totalHairs}
          onChange={(e) => setTotalHairs(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <label className="mt-3 block text-xs text-slate-500">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          onSubmit({
            singles: Number.parseInt(singles, 10) || 0,
            doubles: Number.parseInt(doubles, 10) || 0,
            triples: Number.parseInt(triples, 10) || 0,
            multiples: Number.parseInt(multiples, 10) || 0,
            total_hairs: totalHairs ? Number.parseInt(totalHairs, 10) : null,
            note: note.trim() || null,
          })
        }
        className={cn(fiOsChromeClasses.toolbarControlSurface, "mt-4 px-4 py-2 text-sm font-semibold text-violet-100")}
      >
        Record tray count
      </button>
    </ModalShell>
  );
}

function CorrectModal({
  initial,
  pending,
  onClose,
  onSubmit,
}: {
  initial?: SurgeryOsGraftSummary;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    extracted: number;
    implanted: number;
    discarded: number;
    singles?: number;
    doubles?: number;
    triples?: number;
    multiples?: number;
    total_hairs?: number;
    note?: string | null;
  }) => void;
}) {
  const [extracted, setExtracted] = useState(String(initial?.extractedGrafts ?? 0));
  const [implanted, setImplanted] = useState(String(initial?.implantedGrafts ?? 0));
  const [discarded, setDiscarded] = useState(String(initial?.discardedGrafts ?? 0));
  const [note, setNote] = useState("");

  return (
    <ModalShell title="Correct graft counts" onClose={onClose}>
      <p className="text-xs text-slate-500">Set authoritative totals. Requires surgeon or theatre manager role.</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["Extracted", extracted, setExtracted],
            ["Implanted", implanted, setImplanted],
            ["Discarded", discarded, setDiscarded],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="block text-xs text-slate-500">
            {label}
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-xs text-slate-500">
        Reason (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          onSubmit({
            extracted: Number.parseInt(extracted, 10) || 0,
            implanted: Number.parseInt(implanted, 10) || 0,
            discarded: Number.parseInt(discarded, 10) || 0,
            note: note.trim() || null,
          })
        }
        className={cn(fiOsChromeClasses.toolbarControlSurface, "mt-4 px-4 py-2 text-sm font-semibold text-violet-100")}
      >
        Apply correction
      </button>
    </ModalShell>
  );
}

function ReconcileModal({
  graft,
  pending,
  onClose,
  onSubmit,
}: {
  graft?: SurgeryOsGraftSummary;
  pending: boolean;
  onClose: () => void;
  onSubmit: (note: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const remaining = graft?.remainingGrafts ?? 0;

  return (
    <ModalShell title="Reconcile grafts" onClose={onClose}>
      <p className="text-sm text-slate-400">
        Confirms extracted − implanted − discarded = 0. Current remaining:{" "}
        <span className={remaining === 0 ? "text-emerald-400" : "text-rose-400"}>{remaining}</span>
      </p>
      <label className="mt-3 block text-xs text-slate-500">
        Note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending || remaining !== 0}
        onClick={() => onSubmit(note.trim() || null)}
        className={cn(fiOsChromeClasses.toolbarControlSurface, "mt-4 px-4 py-2 text-sm font-semibold text-violet-100")}
      >
        Complete reconciliation
      </button>
    </ModalShell>
  );
}
