"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  addSurgeryNoteAction,
  createSurgeryFromBookingAction,
  logSurgeryEventAction,
  transitionSurgeryPhaseAction,
  updateSurgeryTeamStatusAction,
} from "@/lib/actions/fi-surgery-os-actions";
import {
  SURGERY_OS_ASSIGNMENT_STATUS_LABELS,
  SURGERY_OS_NOTE_KIND_LABELS,
  SURGERY_OS_PROCEDURE_EVENT_LABELS,
  type SurgeryOsAssignmentStatus,
  type SurgeryOsNoteKind,
  type SurgeryOsViewerRole,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  nextMajorPhase,
  resolveCurrentMajorPhase,
  resolveSurgeryOsStaffRoleCategory,
  surgeryOsActionAllowed,
  surgeryOsNoteKindAllowed,
  SURGERY_OS_LOGGABLE_EVENT_KINDS,
  type SurgeryOsLoggableEventKind,
  type SurgeryOsMajorPhase,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";
import type {
  SurgeryOsLiveSurgery,
  SurgeryOsTeamMember,
} from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";

type ModalKind = "phase" | "event" | "note" | "team" | "booking" | null;

function surgeryStatusFromLive(s: SurgeryOsLiveSurgery): {
  status: string;
  procedurePhase: string;
} {
  const phase = s.procedurePhase;
  let status = "in_progress";
  if (phase === "completed") status = "completed";
  else if (phase === "pre_op" || phase === "patient_arrived" || phase === "design")
    status = "pre_op";
  else if (phase === "extraction_paused" || phase === "break") status = "paused";
  return { status, procedurePhase: phase };
}

export function SurgeryOsLiveActions({
  tenantId,
  viewerRole,
  staffRole,
  surgeries,
  teamAssignments,
  onMutated,
}: {
  tenantId: string;
  viewerRole: SurgeryOsViewerRole;
  staffRole: string | null;
  surgeries: SurgeryOsLiveSurgery[];
  teamAssignments: SurgeryOsTeamMember[];
  onMutated: () => void;
}) {
  const staffCategory = resolveSurgeryOsStaffRoleCategory(staffRole);
  const ctx = useMemo(
    () => ({
      viewerRole,
      staffRoleCategory: staffCategory,
      actorFiUserId: null,
    }),
    [viewerRole, staffCategory]
  );

  const canPhase = surgeryOsActionAllowed(ctx, "transition_phase");
  const canEvent = surgeryOsActionAllowed(ctx, "log_event");
  const canNote = surgeryOsActionAllowed(ctx, "add_note");
  const canTeam =
    surgeryOsActionAllowed(ctx, "update_team_status") || staffCategory === "technician";
  const canBooking = surgeryOsActionAllowed(ctx, "create_from_booking");

  const anyAction = canPhase || canEvent || canNote || canTeam || canBooking;

  const [modal, setModal] = useState<ModalKind>(null);
  const [surgeryId, setSurgeryId] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!anyAction) return null;

  const selectedSurgery = surgeries.find((s) => s.id === surgeryId) ?? surgeries[0] ?? null;
  const effectiveSurgeryId = selectedSurgery?.id ?? "";

  const teamForSurgery = teamAssignments.filter((t) => t.surgeryId === effectiveSurgeryId);

  const currentMajor = selectedSurgery
    ? resolveCurrentMajorPhase(surgeryStatusFromLive(selectedSurgery))
    : null;
  const nextPhase = currentMajor ? nextMajorPhase(currentMajor) : null;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      setModal(null);
      onMutated();
    });
  }

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80">
          Live actions
        </span>
        {surgeries.length > 0 ? (
          <select
            value={effectiveSurgeryId}
            onChange={(e) => setSurgeryId(e.target.value)}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "px-2 py-1.5 text-xs text-slate-200"
            )}
          >
            {surgeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patientLabel}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-500">No active surgeries</span>
        )}
        {canPhase && selectedSurgery && nextPhase ? (
          <ActionButton
            icon={Play}
            label="Continue phase"
            onClick={() => setModal("phase")}
            primary
          />
        ) : null}
        {canEvent || canNote || canTeam || canBooking ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSecondary((v) => !v)}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "px-2.5 py-1.5 text-xs font-semibold text-slate-400"
              )}
            >
              More actions
            </button>
            {showSecondary ? (
              <div className="absolute left-0 top-full z-20 mt-1 flex min-w-[11rem] flex-col gap-1 rounded-lg border border-white/[0.1] bg-[#0c1220] p-1 shadow-lg">
                {canEvent && selectedSurgery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSecondary(false);
                      setModal("event");
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                  >
                    Log event
                  </button>
                ) : null}
                {canNote && selectedSurgery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSecondary(false);
                      setModal("note");
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                  >
                    Add note
                  </button>
                ) : null}
                {canTeam && teamForSurgery.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSecondary(false);
                      setModal("team");
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                  >
                    Team status
                  </button>
                ) : null}
                {canBooking ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSecondary(false);
                      setModal("booking");
                    }}
                    className="rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
                  >
                    Create from booking
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {pending ? <Loader2 className="h-4 w-4 animate-spin text-cyan-400" aria-hidden /> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}

      {modal === "phase" && selectedSurgery && nextPhase ? (
        <ModalShell title="Start next phase" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-400">
            Advance <span className="text-slate-200">{selectedSurgery.patientLabel}</span> from{" "}
            <span className="capitalize text-slate-200">{currentMajor?.replace(/_/g, " ")}</span> to{" "}
            <span className="capitalize text-cyan-300">{nextPhase.replace(/_/g, " ")}</span>.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                transitionSurgeryPhaseAction(tenantId, {
                  surgery_id: effectiveSurgeryId,
                  to_phase: nextPhase,
                })
              )
            }
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "mt-4 px-4 py-2 text-sm font-semibold text-cyan-100"
            )}
          >
            Confirm phase transition
          </button>
        </ModalShell>
      ) : null}

      {modal === "event" && selectedSurgery ? (
        <EventModal
          pending={pending}
          onClose={() => setModal(null)}
          onSubmit={(eventKind, customLabel, customBody) =>
            run(() =>
              logSurgeryEventAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                event_kind: eventKind,
                custom_label: customLabel,
                custom_body: customBody,
              })
            )
          }
        />
      ) : null}

      {modal === "note" && selectedSurgery ? (
        <NoteModal
          pending={pending}
          ctx={ctx}
          onClose={() => setModal(null)}
          onSubmit={(noteKind, body) =>
            run(() =>
              addSurgeryNoteAction(tenantId, {
                surgery_id: effectiveSurgeryId,
                note_kind: noteKind,
                body,
              })
            )
          }
        />
      ) : null}

      {modal === "team" ? (
        <TeamModal
          pending={pending}
          team={teamForSurgery}
          onClose={() => setModal(null)}
          onSubmit={(assignmentId, fiUserId, status) =>
            run(() =>
              updateSurgeryTeamStatusAction(tenantId, {
                assignment_id: assignmentId,
                assignment_fi_user_id: fiUserId,
                status,
              })
            )
          }
        />
      ) : null}

      {modal === "booking" ? (
        <BookingModal
          pending={pending}
          onClose={() => setModal(null)}
          onSubmit={(bookingId) =>
            run(async () => {
              const r = await createSurgeryFromBookingAction(tenantId, { booking_id: bookingId });
              return r;
            })
          }
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        fiOsChromeClasses.toolbarControlSurface,
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold",
        primary ? "text-cyan-100" : "text-slate-200"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EventModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (kind: SurgeryOsLoggableEventKind, label: string | null, body: string | null) => void;
}) {
  const [eventKind, setEventKind] = useState<SurgeryOsLoggableEventKind>("patient_arrived");
  const [customLabel, setCustomLabel] = useState("");
  const [customBody, setCustomBody] = useState("");

  return (
    <ModalShell title="Log procedure event" onClose={onClose}>
      <label className="block text-xs text-slate-500">
        Event
        <select
          value={eventKind}
          onChange={(e) => setEventKind(e.target.value as SurgeryOsLoggableEventKind)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          {SURGERY_OS_LOGGABLE_EVENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {SURGERY_OS_PROCEDURE_EVENT_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      {eventKind === "custom" ? (
        <>
          <label className="mt-3 block text-xs text-slate-500">
            Label
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-500">
            Details
            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            />
          </label>
        </>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          onSubmit(
            eventKind,
            eventKind === "custom" ? customLabel || null : null,
            eventKind === "custom" ? customBody || null : null
          )
        }
        className={cn(
          fiOsChromeClasses.toolbarControlSurface,
          "mt-4 px-4 py-2 text-sm font-semibold text-cyan-100"
        )}
      >
        Log event
      </button>
    </ModalShell>
  );
}

function NoteModal({
  pending,
  ctx,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  ctx: {
    viewerRole: SurgeryOsViewerRole;
    staffRoleCategory: ReturnType<typeof resolveSurgeryOsStaffRoleCategory>;
    actorFiUserId: string | null;
  };
  onClose: () => void;
  onSubmit: (kind: SurgeryOsNoteKind, body: string) => void;
}) {
  const allowedKinds = (Object.keys(SURGERY_OS_NOTE_KIND_LABELS) as SurgeryOsNoteKind[]).filter(
    (k) => surgeryOsNoteKindAllowed(ctx, k)
  );
  const [noteKind, setNoteKind] = useState<SurgeryOsNoteKind>(allowedKinds[0] ?? "general");
  const [body, setBody] = useState("");

  return (
    <ModalShell title="Add operational note" onClose={onClose}>
      <label className="block text-xs text-slate-500">
        Note type
        <select
          value={noteKind}
          onChange={(e) => setNoteKind(e.target.value as SurgeryOsNoteKind)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          {allowedKinds.map((k) => (
            <option key={k} value={k}>
              {SURGERY_OS_NOTE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs text-slate-500">
        Note
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending || !body.trim()}
        onClick={() => onSubmit(noteKind, body.trim())}
        className={cn(
          fiOsChromeClasses.toolbarControlSurface,
          "mt-4 px-4 py-2 text-sm font-semibold text-cyan-100"
        )}
      >
        Save note
      </button>
    </ModalShell>
  );
}

function TeamModal({
  pending,
  team,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  team: SurgeryOsTeamMember[];
  onClose: () => void;
  onSubmit: (assignmentId: string, fiUserId: string, status: SurgeryOsAssignmentStatus) => void;
}) {
  const [assignmentId, setAssignmentId] = useState(team[0]?.id ?? "");
  const [status, setStatus] = useState<SurgeryOsAssignmentStatus>("active");
  const selected = team.find((t) => t.id === assignmentId);

  return (
    <ModalShell title="Update team status" onClose={onClose}>
      <label className="block text-xs text-slate-500">
        Team member
        <select
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          {team.map((t) => (
            <option key={t.id} value={t.id}>
              {t.staffLabel} · {t.roleLabel}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs text-slate-500">
        Status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SurgeryOsAssignmentStatus)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          {(Object.keys(SURGERY_OS_ASSIGNMENT_STATUS_LABELS) as SurgeryOsAssignmentStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {SURGERY_OS_ASSIGNMENT_STATUS_LABELS[s]}
              </option>
            )
          )}
        </select>
      </label>
      <button
        type="button"
        disabled={pending || !selected}
        onClick={() => selected && onSubmit(selected.id, selected.fiUserId, status)}
        className={cn(
          fiOsChromeClasses.toolbarControlSurface,
          "mt-4 px-4 py-2 text-sm font-semibold text-cyan-100"
        )}
      >
        Update status
      </button>
    </ModalShell>
  );
}

function BookingModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (bookingId: string) => void;
}) {
  const [bookingId, setBookingId] = useState("");

  return (
    <ModalShell title="Create surgery from booking" onClose={onClose}>
      <p className="text-xs text-slate-500">
        Enter the confirmed surgery booking ID. Duplicate bookings return the existing surgery
        record.
      </p>
      <label className="mt-3 block text-xs text-slate-500">
        Booking ID
        <input
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="00000000-0000-4000-8000-000000000001"
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
      </label>
      <button
        type="button"
        disabled={pending || !bookingId.trim()}
        onClick={() => onSubmit(bookingId.trim())}
        className={cn(
          fiOsChromeClasses.toolbarControlSurface,
          "mt-4 px-4 py-2 text-sm font-semibold text-cyan-100"
        )}
      >
        Create surgery
      </button>
    </ModalShell>
  );
}

export { type SurgeryOsMajorPhase };
