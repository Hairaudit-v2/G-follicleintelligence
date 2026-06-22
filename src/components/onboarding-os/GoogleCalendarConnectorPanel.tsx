"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  approveExternalCalendarEventAction,
  loadGoogleCalendarConnectorSnapshotAction,
  rejectExternalCalendarEventAction,
  runGoogleCalendarSyncAction,
} from "@/lib/actions/fi-onboarding-os-google-calendar-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  EXTERNAL_CALENDAR_EVENT_TYPE_LABELS,
  EXTERNAL_CALENDAR_IMPORT_STATUS_BADGES,
} from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";
import type {
  ExternalCalendarStagingEvent,
  GoogleCalendarConnectorSnapshot,
} from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

const BADGE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-500/15 text-slate-300",
  info: "bg-cyan-500/15 text-cyan-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
};

const HEALTH_BAND_CLASSES: Record<string, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  unhealthy: "text-red-400",
  unknown: "text-slate-400",
};

type Props = {
  tenantId: string;
  integrationId: string;
  integrationLabel?: string;
  sessionId?: string | null;
  initialSnapshot?: GoogleCalendarConnectorSnapshot | null;
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASSES[tone] ?? BADGE_CLASSES.neutral}`}
    >
      {label}
    </span>
  );
}

function StagingEventReviewCard({
  event,
  pending,
  onApprove,
  onReject,
}: {
  event: ExternalCalendarStagingEvent;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const badge = EXTERNAL_CALENDAR_IMPORT_STATUS_BADGES[event.importStatus];
  const typeLabel = EXTERNAL_CALENDAR_EVENT_TYPE_LABELS[event.normalizedEventType];
  const canReview = event.importStatus === "staged" || event.importStatus === "reviewed";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-100">{event.eventTitle}</p>
          <p className="text-xs text-slate-400">
            {event.startAt ? new Date(event.startAt).toLocaleString() : "No start time"}
            {event.endAt ? ` → ${new Date(event.endAt).toLocaleString()}` : ""}
          </p>
        </div>
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>

      <div className="grid gap-1 text-xs text-slate-400">
        <p>
          Suggested type: <span className="text-cyan-300">{typeLabel}</span>
        </p>
        {event.attendeeEmails.length > 0 ? (
          <p>Attendees: {event.attendeeEmails.join(", ")}</p>
        ) : null}
        <p className="text-slate-500">Google event ID: {event.googleEventId}</p>
      </div>

      {canReview ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onApprove}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          {event.importStatus === "approved"
            ? "Approved for staging — no FI booking created."
            : event.importStatus === "rejected"
              ? "Rejected — will not be imported."
              : "Review complete."}
        </p>
      )}
    </div>
  );
}

export function GoogleCalendarConnectorPanel({
  tenantId,
  integrationId,
  integrationLabel = "Google Calendar",
  sessionId,
  initialSnapshot,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState<GoogleCalendarConnectorSnapshot | null>(initialSnapshot ?? null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [queueFilter, setQueueFilter] = useState<"staged" | "all">("staged");

  useEffect(() => {
    if (initialSnapshot) return;
    let cancelled = false;
    void loadGoogleCalendarConnectorSnapshotAction(tenantId, integrationId).then((res) => {
      if (cancelled || !res.ok || !res.snapshot) return;
      setSnapshot(res.snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSnapshot, tenantId, integrationId]);

  const health = snapshot?.syncHealth;
  const latestRun = snapshot?.latestSyncRun;
  const stagingQueue =
    queueFilter === "staged"
      ? (snapshot?.stagingQueue ?? []).filter((e) => e.importStatus === "staged")
      : (snapshot?.stagingQueue ?? []);

  function refreshSnapshot(resSnapshot?: GoogleCalendarConnectorSnapshot) {
    if (resSnapshot) setSnapshot(resSnapshot);
  }

  function runSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await runGoogleCalendarSyncAction(tenantId, integrationId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({
        kind: "ok",
        text: `Sync complete — ${res.snapshot?.latestSyncRun?.eventsStaged ?? 0} event(s) staged for review. No FI bookings created.`,
      });
      router.refresh();
    });
  }

  function approveEvent(eventId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await approveExternalCalendarEventAction(tenantId, integrationId, eventId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Event approved — remains in staging only; no FI booking created." });
      router.refresh();
    });
  }

  function rejectEvent(eventId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await rejectExternalCalendarEventAction(tenantId, integrationId, eventId, sessionId);
      if (!res.ok) {
        setMessage({ kind: "err", text: res.error });
        return;
      }
      refreshSnapshot(res.snapshot);
      setMessage({ kind: "ok", text: "Event rejected." });
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#060d18]/80 p-4 sm:p-5 space-y-4">
      <div>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase F3</p>
        <h2 className="text-lg font-semibold text-slate-50">{integrationLabel} — Read-only sync</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Discover external calendar events and stage them for human review. Read-only access — never writes back to
          Google Calendar and never creates FI bookings automatically.
        </p>
      </div>

      <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
        Staging only — all external events require manual approval. No automatic booking creation.
      </div>

      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Last sync</p>
          <p className="mt-1 text-sm font-medium text-slate-100">
            {health?.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString() : "Never"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Events discovered</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{latestRun?.eventsDiscovered ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Sync health</p>
          <p className={`mt-1 text-sm font-medium ${HEALTH_BAND_CLASSES[health?.healthBand ?? "unknown"]}`}>
            {health?.healthScore ?? 0}% · {health?.healthBand ?? "unknown"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500">Pending review</p>
          <p className="mt-1 text-sm font-medium text-cyan-300">{health?.stagedPendingReview ?? 0}</p>
        </div>
      </div>

      {health?.summary ? <p className="text-xs text-slate-500">{health.summary}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={runSync}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Sync now
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-300">Staging queue</h3>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setQueueFilter("staged")}
              className={`rounded px-2 py-1 ${queueFilter === "staged" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              Pending review
            </button>
            <button
              type="button"
              onClick={() => setQueueFilter("all")}
              className={`rounded px-2 py-1 ${queueFilter === "all" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              All staged
            </button>
          </div>
        </div>

        {stagingQueue.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {stagingQueue.map((event) => (
              <StagingEventReviewCard
                key={event.id}
                event={event}
                pending={pending}
                onApprove={() => approveEvent(event.id)}
                onReject={() => rejectEvent(event.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No events in staging queue. Run a manual sync after verifying Google Calendar credentials.
          </p>
        )}
      </div>
    </section>
  );
}
