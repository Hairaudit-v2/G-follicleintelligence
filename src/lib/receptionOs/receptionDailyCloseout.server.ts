import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import { computeTomorrowOperationalWindow } from "@/src/lib/clinicOs/tomorrowBoardModel";
import {
  buildReceptionCloseoutSnapshot,
  type ReceptionCloseoutChecklistItem,
  type ReceptionCloseoutSnapshot,
  type TomorrowFirstPatientReadiness,
} from "@/src/lib/receptionOs/receptionDailyCloseoutModel";
import { loadFailedReceptionCommunicationsForOperationalDay } from "@/src/lib/receptionOs/receptionCommunicationDelivery.server";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { receptionCloseoutCloseDayAllowed } from "@/src/lib/receptionOs/receptionCloseoutPolicy";

type ReceptionCloseoutCommandCentreInput = Omit<
  ReceptionOsCommandCentrePayload,
  | "endOfDayCloseout"
  | "systemStatus"
  | "pilotMetrics"
  | "pilotReview"
  | "ownerValue"
  | "demoMode"
  | "moduleHealth"
>;

async function resolveTenantDefaultClinicId(tenantId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  return data ? String((data as { id: string }).id) : null;
}

async function loadTomorrowFirstPatientReadiness(
  tenantId: string,
  calendarTimezone: string,
  now: Date,
  base: string,
): Promise<TomorrowFirstPatientReadiness | null> {
  const window = computeTomorrowOperationalWindow(now, calendarTimezone);
  const bookings = await loadBookingsForTenantRange(tenantId, window.localStartIso, window.localEndIso);
  const sorted = bookings
    .filter((b) => ["scheduled", "confirmed"].includes(String(b.booking_status ?? "").toLowerCase()))
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  const first = sorted[0];
  if (!first) return null;

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: window.calendarTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(String(first.start_at)));

  return {
    bookingId: String(first.id),
    patientLabel: first.title?.trim() || "Patient",
    appointmentTime: time,
    readinessLabel: "Review chart + prep checklist",
    href: `${base}/appointments?bookingId=${first.id}`,
  };
}

async function loadExistingCloseout(
  tenantId: string,
  operatingDate: string,
  clinicId: string | null,
): Promise<{ id: string; notes: string | null; closedAt: string } | null> {
  const supabase = supabaseAdmin();
  let query = supabase
    .from("fi_reception_daily_closeouts")
    .select("id, notes, closed_at, clinic_id")
    .eq("tenant_id", tenantId)
    .eq("operating_date", operatingDate);

  if (clinicId) query = query.eq("clinic_id", clinicId);
  else query = query.is("clinic_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (error.message.includes("does not exist")) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    notes: (data as { notes: string | null }).notes,
    closedAt: String((data as { closed_at: string }).closed_at),
  };
}

export async function loadReceptionCloseoutSnapshotForCommandCentre(
  payload: ReceptionCloseoutCommandCentreInput,
  now: Date = new Date(),
): Promise<ReceptionCloseoutSnapshot> {
  const tenantId = payload.tenantId;
  let failedCommunications: Awaited<ReturnType<typeof loadFailedReceptionCommunicationsForOperationalDay>> = [];
  let clinicId: string | null = null;
  let tomorrowFirstPatient: Awaited<ReturnType<typeof loadTomorrowFirstPatientReadiness>> = null;
  let existingCloseout: Awaited<ReturnType<typeof loadExistingCloseout>> = null;

  try {
    [failedCommunications, clinicId] = await Promise.all([
      loadFailedReceptionCommunicationsForOperationalDay(tenantId, payload.operationalDay),
      resolveTenantDefaultClinicId(tenantId),
    ]);
  } catch (error) {
    console.error("[loadReceptionCloseoutSnapshotForCommandCentre:deliveries]", error);
  }

  try {
    tomorrowFirstPatient = await loadTomorrowFirstPatientReadiness(
      tenantId,
      payload.operationalDay.calendarTimezone,
      now,
      `/fi-admin/${tenantId}`,
    );
  } catch (error) {
    console.error("[loadReceptionCloseoutSnapshotForCommandCentre:tomorrow]", error);
  }

  try {
    existingCloseout = await loadExistingCloseout(
      tenantId,
      payload.operationalDay.todayYmd,
      clinicId,
    );
  } catch (error) {
    console.error("[loadReceptionCloseoutSnapshotForCommandCentre:existing]", error);
  }

  return buildReceptionCloseoutSnapshot({
    board: payload,
    tasks: payload.receptionTasks,
    failedCommunications,
    tomorrowFirstPatient,
    canCloseDay: receptionCloseoutCloseDayAllowed(payload.viewer.role) && !existingCloseout,
    existingCloseout,
  });
}

export type CreateReceptionDailyCloseoutParams = {
  tenantId: string;
  operatingDate: string;
  closedByFiUserId: string | null;
  notes: string | null;
  snapshot: ReceptionCloseoutSnapshot;
};

export async function createReceptionDailyCloseout(
  params: CreateReceptionDailyCloseoutParams,
): Promise<{ closeoutId: string }> {
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId").trim();
  const clinicId = await resolveTenantDefaultClinicId(tenantId);
  const supabase = supabaseAdmin();

  const existing = await loadExistingCloseout(tenantId, params.operatingDate, clinicId);
  if (existing) throw new Error("This operating day has already been closed.");

  const { data: closeout, error } = await supabase
    .from("fi_reception_daily_closeouts")
    .insert({
      tenant_id: tenantId,
      clinic_id: clinicId,
      operating_date: params.operatingDate,
      closed_by: params.closedByFiUserId,
      risk_summary: params.snapshot.riskSummary,
      notes: params.notes?.trim() || null,
      item_counts: params.snapshot.itemCounts,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error("Reception daily closeout is not available (migration pending).");
    }
    throw new Error(error.message);
  }

  const closeoutId = String((closeout as { id: string }).id);
  const itemRows = params.snapshot.checklist.map((item: ReceptionCloseoutChecklistItem) => ({
    closeout_id: closeoutId,
    tenant_id: tenantId,
    item_kind: item.itemKind,
    severity: item.severity,
    status: item.status,
    title: item.title,
    detail: item.detail,
    source_ref_id: item.sourceRefId,
    href: item.href,
    metadata: item.metadata ?? {},
  }));

  if (itemRows.length) {
    const { error: itemsError } = await supabase.from("fi_reception_daily_closeout_items").insert(itemRows);
    if (itemsError) throw new Error(itemsError.message);
  }

  return { closeoutId };
}
