/**
 * FI-UX-REBUILD D6E — pure presence derivation from existing operational signals.
 * No DB writes. No duplicate attendance system.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { bookingHasPendingArrivalIntent } from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";
import { inferTodaySignalKind } from "@/src/lib/fiOs/todaySignal/todaySignalPriority";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import type {
  ReceptionBoardCard,
  TenantOperationalDashboard,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

import type {
  PresenceConfidence,
  PresenceEngineContext,
  PresenceOperationalStatus,
  PresenceSnapshot,
  PresenceState,
  PresenceSummary,
} from "./presenceTypes";

const RECEPTION_RECENT_ACTION_MS = 45 * 60_000;
const SNAPSHOT_TTL_MS = 30 * 60_000;

export type PresenceDeriveInput = {
  context: PresenceEngineContext;
  todayItems: readonly TodayFeedItem[];
  receptionCards?: readonly ReceptionBoardCard[];
};

function nowMs(context: PresenceEngineContext): number {
  const iso = context.nowIso ?? new Date().toISOString();
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}

function roleLabel(role: string): string {
  switch (role) {
    case "reception":
      return "Reception";
    case "doctor":
      return "Doctor";
    case "surgeon":
      return "Surgeon";
    case "nurse":
      return "Nurse";
    case "consultant":
      return "Consultant";
    case "clinic_manager":
      return "Clinic manager";
    default:
      return role.replace(/_/g, " ");
  }
}

export function classifyPresenceState(snapshot: Pick<PresenceSnapshot, "state" | "signalKind">): PresenceState {
  if (snapshot.state === "unknown") return "unknown";
  if (snapshot.signalKind === "clinic_unattended") return "unattended";
  if (snapshot.signalKind === "role_uncovered" || snapshot.signalKind === "reception_missing") {
    return "missing";
  }
  if (snapshot.signalKind === "role_covered" || snapshot.signalKind === "staff_active_session") {
    return snapshot.state === "active" ? "active" : "present";
  }
  return snapshot.state;
}

export function scorePresenceConfidence(
  snapshot: Pick<PresenceSnapshot, "source" | "signalKind" | "confidence">
): PresenceConfidence {
  if (snapshot.source.includes("booking_assignment")) return "low";
  if (snapshot.signalKind === "clinic_unattended") return "medium";
  if (
    snapshot.signalKind === "patient_arrival_intent" ||
    snapshot.signalKind === "patient_checked_in"
  ) {
    return snapshot.source.includes("reception_board") ? "high" : "medium";
  }
  if (snapshot.signalKind === "role_covered" && snapshot.source.includes("viewer_session")) {
    return "medium";
  }
  if (snapshot.signalKind === "reception_missing" || snapshot.signalKind === "doctor_missing") {
    return "low";
  }
  return snapshot.confidence;
}

export function derivePatientPresenceFromTodayItems(
  items: readonly TodayFeedItem[],
  context: PresenceEngineContext
): PresenceSnapshot[] {
  const snapshots: PresenceSnapshot[] = [];
  const at = context.nowIso ?? new Date().toISOString();

  for (const item of items) {
    const kind = inferTodaySignalKind(item);
    if (kind === "arrival_intent") {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "expected",
        signalKind: "patient_arrival_intent",
        confidence: "high",
        observedAt: at,
        expiresAt: isoAt(nowMs(context) + SNAPSHOT_TTL_MS),
        source: "today_feed:arrival_intent",
        safeLabel: "Patient arrival intent",
        reasonLabel: "Patient says they're here — awaiting confirmation",
      });
    }
    if (kind === "reception_waiting" || kind === "reception_in_clinic") {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "present",
        signalKind: "patient_checked_in",
        confidence: "high",
        observedAt: at,
        source: "today_feed:reception_board",
        safeLabel: "Patient checked in",
        reasonLabel: "Patient is in clinic — reception confirmed",
      });
    }
    if (kind === "consultation") {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "present",
        signalKind: "consultation_ready",
        confidence: "medium",
        observedAt: at,
        source: "today_feed:consultation",
        safeLabel: "Consultation ready",
        reasonLabel: "Consultation may be ready to start",
      });
    }
  }

  return snapshots;
}

export function derivePatientPresenceFromReceptionCards(
  cards: readonly ReceptionBoardCard[],
  context: PresenceEngineContext
): PresenceSnapshot[] {
  const snapshots: PresenceSnapshot[] = [];
  const at = context.nowIso ?? new Date().toISOString();

  for (const card of cards) {
    if (
      bookingHasPendingArrivalIntent({
        booking_status: card.bookingStatus,
        metadata: card.metadata ?? {},
      })
    ) {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "expected",
        signalKind: "patient_arrival_intent",
        confidence: "high",
        observedAt: at,
        source: "reception_board:arrival_intent",
        safeLabel: "Patient arrival intent",
        reasonLabel: "Arrival intent recorded — not fully checked in",
      });
    } else if (card.receptionColumn === "arrived" || card.bookingStatus === "arrived") {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "present",
        signalKind: "patient_checked_in",
        confidence: "high",
        observedAt: at,
        source: "reception_board:arrived",
        safeLabel: "Patient checked in",
        reasonLabel: "Patient waiting in clinic",
      });
    } else if (
      card.receptionColumn === "in_consultation" ||
      card.receptionColumn === "in_treatment"
    ) {
      snapshots.push({
        tenantId: context.tenantId,
        actorKind: "patient",
        state: "active",
        signalKind: "consultation_ready",
        confidence: "high",
        observedAt: at,
        source: "reception_board:in_clinic",
        safeLabel: "Patient in consultation",
        reasonLabel: "Patient is with care team",
      });
    }
  }

  return snapshots;
}

export function deriveRolePresenceFromWorkspaceProfile(
  profileKey: FiWorkspaceProfileKey | undefined,
  context: PresenceEngineContext
): PresenceSnapshot[] {
  if (!profileKey || profileKey === "default" || profileKey === "platform_admin") {
    return [];
  }

  const at = context.nowIso ?? new Date().toISOString();
  const role = profileKey;

  if (context.viewerSessionActive !== false) {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role,
        state: "active",
        signalKind: "role_covered",
        confidence: "medium",
        observedAt: at,
        source: "workspace_profile:viewer_session",
        safeLabel: `${roleLabel(role)} session active`,
        reasonLabel: "Viewer workspace session suggests role coverage",
      },
    ];
  }

  return [];
}

function deriveReceptionPresence(
  items: readonly TodayFeedItem[],
  context: PresenceEngineContext,
  hasViewerReceptionSession: boolean
): PresenceSnapshot[] {
  const at = context.nowIso ?? new Date().toISOString();
  const hasRecentReceptionAction = items.some((item) => {
    const kind = inferTodaySignalKind(item);
    return (
      kind === "reception_waiting" ||
      kind === "reception_in_clinic" ||
      (kind === "arrival_intent" && item.actionHint === "Confirm check-in")
    );
  });

  if (hasViewerReceptionSession || context.profileKey === "reception") {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role: "reception",
        state: "active",
        signalKind: "role_covered",
        confidence: "medium",
        observedAt: at,
        source: "workspace_profile:reception_session",
        safeLabel: "Reception session active",
        reasonLabel: "Reception workspace session detected",
      },
    ];
  }

  if (hasRecentReceptionAction) {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role: "reception",
        state: "present",
        signalKind: "staff_recent_action",
        confidence: "medium",
        observedAt: at,
        source: "today_feed:reception_action",
        safeLabel: "Reception activity detected",
        reasonLabel: "Recent reception board activity",
      },
    ];
  }

  const hasArrivalIntent = items.some((i) => inferTodaySignalKind(i) === "arrival_intent");
  if (hasArrivalIntent) {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role: "reception",
        state: "unknown",
        signalKind: "reception_missing",
        confidence: "low",
        observedAt: at,
        source: "presence_inference:no_reception_signal",
        safeLabel: "Reception not confirmed",
        reasonLabel: "Patient arrival intent without confirmed reception activity",
      },
    ];
  }

  return [
    {
      tenantId: context.tenantId,
      actorKind: "role",
      role: "reception",
      state: "unknown",
      signalKind: "role_uncovered",
      confidence: "low",
      observedAt: at,
      source: "presence_inference:unknown",
      safeLabel: "Reception coverage unknown",
      reasonLabel: "No reception activity signal available",
    },
  ];
}

function deriveDoctorPresence(
  items: readonly TodayFeedItem[],
  context: PresenceEngineContext
): PresenceSnapshot[] {
  const at = context.nowIso ?? new Date().toISOString();
  const doctorProfiles = new Set(["doctor", "surgeon", "consultant"]);
  if (context.profileKey && doctorProfiles.has(context.profileKey)) {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role: context.profileKey,
        state: "active",
        signalKind: "role_covered",
        confidence: "medium",
        observedAt: at,
        source: "workspace_profile:viewer_session",
        safeLabel: `${roleLabel(context.profileKey)} session active`,
        reasonLabel: "Clinical workspace session detected",
      },
    ];
  }

  const consultationReady = items.some((i) => inferTodaySignalKind(i) === "consultation");
  const patientWaiting = items.some((i) => inferTodaySignalKind(i) === "reception_waiting");
  if (consultationReady && patientWaiting) {
    return [
      {
        tenantId: context.tenantId,
        actorKind: "role",
        role: "doctor",
        state: "unknown",
        signalKind: "doctor_missing",
        confidence: "low",
        observedAt: at,
        source: "presence_inference:consultation_without_doctor",
        safeLabel: "Doctor presence not confirmed",
        reasonLabel: "Patient waiting — doctor coverage needs confirmation",
      },
    ];
  }

  return [];
}

function deriveSurgeryTeamPresence(
  items: readonly TodayFeedItem[],
  context: PresenceEngineContext
): PresenceSnapshot[] {
  const at = context.nowIso ?? new Date().toISOString();
  const surgeryItems = items.filter((i) => {
    const kind = inferTodaySignalKind(i);
    return kind === "surgery_readiness" || kind === "staff_compliance";
  });

  if (surgeryItems.length === 0) return [];

  const surgerySoon = surgeryItems.some((i) =>
    /procedure today|procedure tomorrow|surgery scheduled today|surgery scheduled tomorrow|today —|tomorrow —/i.test(
      `${i.detailLine ?? ""} ${i.actionLabel}`
    )
  );

  const teamIncomplete = surgeryItems.some(
    (i) =>
      inferTodaySignalKind(i) === "staff_compliance" ||
      (inferTodaySignalKind(i) === "surgery_readiness" && i.severity === "critical")
  );

  if (!teamIncomplete) return [];

  return [
    {
      tenantId: context.tenantId,
      actorKind: "role",
      role: "surgery_team",
      state: surgerySoon ? "missing" : "unknown",
      signalKind: "surgery_team_incomplete",
      confidence: surgerySoon ? "medium" : "low",
      observedAt: at,
      source: "entity_attention:surgery_readiness",
      safeLabel: "Surgery team readiness watch",
      reasonLabel: "Team readiness needs confirmation",
    },
  ];
}

function deriveStaffOnDutySignal(context: PresenceEngineContext): PresenceSnapshot[] {
  const count = context.staffOnDutyCount ?? 0;
  if (count <= 0) return [];

  const at = context.nowIso ?? new Date().toISOString();
  return [
    {
      tenantId: context.tenantId,
      actorKind: "staff",
      state: "present",
      signalKind: "role_covered",
      confidence: "low",
      observedAt: at,
      source: "dashboard:booking_assignment",
      safeLabel: "Staff assigned today",
      reasonLabel: "Staff assigned to bookings — not confirmed on-site",
    },
  ];
}

function deriveClinicUnattendedCandidate(
  snapshots: readonly PresenceSnapshot[],
  context: PresenceEngineContext
): PresenceSnapshot | null {
  const hasArrivalIntent = snapshots.some((s) => s.signalKind === "patient_arrival_intent");
  if (!hasArrivalIntent) return null;

  const receptionCovered = snapshots.some(
    (s) =>
      s.role === "reception" &&
      (s.signalKind === "role_covered" || s.signalKind === "staff_recent_action")
  );
  if (receptionCovered) return null;

  const withinWindow = context.withinOperatingWindow !== false;
  if (!withinWindow) return null;

  const at = context.nowIso ?? new Date().toISOString();
  return {
    tenantId: context.tenantId,
    actorKind: "clinic",
    state: "unattended",
    signalKind: "clinic_unattended",
    confidence: "medium",
    observedAt: at,
    expiresAt: isoAt(nowMs(context) + RECEPTION_RECENT_ACTION_MS),
    source: "presence_inference:unattended_candidate",
    safeLabel: "Clinic may appear unattended",
    reasonLabel: "Unattended arrival support may be needed",
  };
}

export function deriveClinicPresenceState(
  snapshots: readonly PresenceSnapshot[],
  context: PresenceEngineContext
): PresenceSnapshot {
  const at = context.nowIso ?? new Date().toISOString();
  const unattended = snapshots.find((s) => s.signalKind === "clinic_unattended");
  if (unattended) return unattended;

  const receptionUnknown = snapshots.some(
    (s) => s.signalKind === "reception_missing" || s.role === "reception"
  );
  const anyActive = snapshots.some(
    (s) => s.state === "active" || s.signalKind === "staff_recent_action"
  );

  if (anyActive && !snapshots.some((s) => s.signalKind === "reception_missing")) {
    return {
      tenantId: context.tenantId,
      actorKind: "clinic",
      state: "active",
      signalKind: "role_covered",
      confidence: "medium",
      observedAt: at,
      source: "presence_aggregate:clinic_active",
      safeLabel: "Clinic active",
      reasonLabel: "Operational activity detected",
    };
  }

  if (receptionUnknown && snapshots.some((s) => s.signalKind === "reception_missing")) {
    return {
      tenantId: context.tenantId,
      actorKind: "clinic",
      state: "unknown",
      signalKind: "reception_missing",
      confidence: "low",
      observedAt: at,
      source: "presence_aggregate:reception_unknown",
      safeLabel: "Reception not confirmed",
      reasonLabel: "Reception coverage needs confirmation",
    };
  }

  return {
    tenantId: context.tenantId,
    actorKind: "clinic",
    state: "unknown",
    signalKind: "role_uncovered",
    confidence: "low",
    observedAt: at,
    source: "presence_aggregate:unknown",
    safeLabel: "Clinic status unknown",
    reasonLabel: "Insufficient presence signals",
  };
}

export function derivePresenceSnapshots(input: PresenceDeriveInput): PresenceSnapshot[] {
  const { context, todayItems, receptionCards = [] } = input;
  const profileKey = context.profileKey as FiWorkspaceProfileKey | undefined;

  const fromItems = derivePatientPresenceFromTodayItems(todayItems, context);
  const fromCards = derivePatientPresenceFromReceptionCards(receptionCards, context);
  const fromProfile = deriveRolePresenceFromWorkspaceProfile(profileKey, context);
  const reception = deriveReceptionPresence(todayItems, context, profileKey === "reception");
  const doctor = deriveDoctorPresence(todayItems, context);
  const surgery = deriveSurgeryTeamPresence(todayItems, context);
  const staffOnDuty = deriveStaffOnDutySignal(context);

  const merged = [
    ...fromItems,
    ...fromCards,
    ...fromProfile,
    ...reception,
    ...doctor,
    ...surgery,
    ...staffOnDuty,
  ];

  const unattended = deriveClinicUnattendedCandidate(merged, context);
  const clinic = unattended ?? deriveClinicPresenceState(merged, context);
  merged.push(clinic);

  return merged.map((s) => ({
    ...s,
    confidence: scorePresenceConfidence(s),
    state: classifyPresenceState(s),
  }));
}

export function getPresenceEscalationSignals(
  snapshots: readonly PresenceSnapshot[],
  _context: PresenceEngineContext
): string[] {
  const hints: string[] = [];
  if (snapshots.some((s) => s.signalKind === "reception_missing")) {
    hints.push("reception_unknown_escalates_arrival");
  }
  if (snapshots.some((s) => s.signalKind === "doctor_missing")) {
    hints.push("doctor_unknown_escalates_consultation");
  }
  if (snapshots.some((s) => s.signalKind === "surgery_team_incomplete")) {
    hints.push("surgery_team_incomplete_escalates_readiness");
  }
  if (snapshots.some((s) => s.signalKind === "clinic_unattended")) {
    hints.push("clinic_unattended_suggest_support");
  }
  return hints;
}

export function summarizePresenceForToday(
  snapshots: readonly PresenceSnapshot[],
  context: PresenceEngineContext
): PresenceSummary {
  const clinicSnapshot =
    snapshots.find((s) => s.actorKind === "clinic") ??
    deriveClinicPresenceState(snapshots, context);

  const chips: PresenceSummary["operationalStatus"]["chips"] = [];

  if (snapshots.some((s) => s.signalKind === "patient_arrival_intent")) {
    chips.push({
      id: "arrival_active",
      label: snapshots.some((s) => s.signalKind === "reception_missing")
        ? "Arrival awaiting reception"
        : "Patient arrivals active",
      tone: snapshots.some((s) => s.signalKind === "reception_missing") ? "attention" : "watch",
    });
  }

  if (snapshots.some((s) => s.signalKind === "surgery_team_incomplete")) {
    chips.push({
      id: "team_readiness",
      label: "Team readiness watch",
      tone: "watch",
    });
  }

  if (snapshots.some((s) => s.signalKind === "clinic_unattended")) {
    chips.push({
      id: "unattended_candidate",
      label: "Unattended arrival support may be needed",
      tone: "attention",
    });
  }

  if (snapshots.some((s) => s.signalKind === "consultation_ready")) {
    chips.push({
      id: "consultation_ready",
      label: "Ready for consult",
      tone: "neutral",
    });
  }

  const tone: PresenceOperationalStatus["tone"] =
    clinicSnapshot.signalKind === "clinic_unattended" ||
    clinicSnapshot.signalKind === "reception_missing"
      ? "attention"
      : clinicSnapshot.state === "active"
        ? "active"
        : clinicSnapshot.state === "unknown"
          ? "unknown"
          : "watch";

  return {
    tenantId: context.tenantId,
    snapshots: snapshots.map(({ actorId: _actorId, ...rest }) => rest),
    operationalStatus: {
      headline: clinicSnapshot.safeLabel,
      subline: clinicSnapshot.reasonLabel,
      chips,
      tone,
    },
    escalationHints: getPresenceEscalationSignals(snapshots, context),
    generatedAt: context.nowIso ?? new Date().toISOString(),
  };
}

/** Apply presence-aware adjustments to Today feed items (ranking + copy hints). */
export function applyPresenceToTodayItems(
  items: readonly TodayFeedItem[],
  summary: PresenceSummary
): TodayFeedItem[] {
  const hints = new Set(summary.escalationHints);

  return items.map((item) => {
    const kind = inferTodaySignalKind(item);
    let next = { ...item };

    if (kind === "arrival_intent" && hints.has("reception_unknown_escalates_arrival")) {
      next = {
        ...next,
        actionHint: "Confirm check-in when reception is available",
        detailLine:
          next.detailLine ??
          "Patient says they're here — reception confirmation needed",
        priorityScore: Math.min(100, next.priorityScore + 12),
        severity: next.severity === "normal" ? "warning" : next.severity,
      };
      if (!next.priorityReasons?.includes("Reception not confirmed")) {
        next.priorityReasons = [...(next.priorityReasons ?? []), "Reception not confirmed"];
      }
    }

    if (kind === "consultation" && hints.has("doctor_unknown_escalates_consultation")) {
      next = {
        ...next,
        priorityScore: Math.min(100, next.priorityScore + 8),
        detailLine: next.detailLine ?? "Ready for consult — doctor coverage needs confirmation",
      };
    }

    if (
      (kind === "surgery_readiness" || kind === "staff_compliance") &&
      hints.has("surgery_team_incomplete_escalates_readiness")
    ) {
      next = {
        ...next,
        priorityScore: Math.min(100, next.priorityScore + 15),
        severity: "critical",
      };
      if (!next.priorityReasons?.includes("Team readiness needs confirmation")) {
        next.priorityReasons = [
          ...(next.priorityReasons ?? []),
          "Team readiness needs confirmation",
        ];
      }
    }

    return next;
  });
}

export function buildPresenceContextFromDashboard(
  dashboard: Pick<
    TenantOperationalDashboard,
    "tenantId" | "quickStats" | "operationalDay"
  >,
  opts: {
    profileKey?: FiWorkspaceProfileKey;
    now?: Date;
  } = {}
): PresenceEngineContext {
  const now = opts.now ?? new Date();
  const hour = Number(
    new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      hour12: false,
      timeZone: dashboard.operationalDay.calendarTimezone?.trim() || undefined,
    }).format(now)
  );
  const withinOperatingWindow = hour >= 7 && hour < 19;

  return {
    tenantId: dashboard.tenantId,
    nowIso: now.toISOString(),
    profileKey: opts.profileKey,
    staffOnDutyCount: dashboard.quickStats.staffOnDutyToday,
    withinOperatingWindow,
    viewerSessionActive: true,
  };
}

export function derivePresenceFromDashboardInput(input: {
  dashboard: Pick<
    TenantOperationalDashboard,
    "tenantId" | "receptionBoard" | "quickStats" | "operationalDay"
  >;
  todayItems: readonly TodayFeedItem[];
  profileKey?: FiWorkspaceProfileKey;
  now?: Date;
}): PresenceSummary {
  const context = buildPresenceContextFromDashboard(input.dashboard, {
    profileKey: input.profileKey,
    now: input.now,
  });
  const snapshots = derivePresenceSnapshots({
    context,
    todayItems: input.todayItems,
    receptionCards: input.dashboard.receptionBoard.cards,
  });
  return summarizePresenceForToday(snapshots, context);
}

/** Guard: presence must never emit Calendar workspace mappings. */
export function presenceSnapshotsAvoidCalendarMappings(
  snapshots: readonly PresenceSnapshot[]
): boolean {
  return !snapshots.some(
    (s) =>
      s.source.includes("calendar") ||
      s.source.includes("google_calendar") ||
      s.safeLabel.toLowerCase().includes("calendar")
  );
}
