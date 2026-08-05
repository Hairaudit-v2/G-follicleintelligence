/**
 * FI-CALENDAR-IDENTITY-LINK-1B — DB-backed calendar person identity resolver.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveCalendarPersonIdentity,
  type CalendarIdentityCandidate,
  type CalendarPersonIdentityResolution,
} from "@/src/lib/calendar/calendarPersonIdentity";
import {
  normalizeCalendarIdentityPhone,
  verifiedCalendarIdentityEmail,
} from "@/src/lib/calendar/calendarPersonIdentityNormalize";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type ResolveCalendarPersonIdentityForEventInput = {
  tenantId: string;
  eventId: string;
  /** When true, persist identity_state snapshot onto event metadata (non-destructive). */
  persistResolution?: boolean;
  actingUserId?: string | null;
};

function readMetaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function personDisplayName(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const { name } = displayFromPersonMetadata(meta);
  return name && name !== "—" ? name : null;
}

/**
 * Resolve CalendarOS event → FiOS patient / consultation / enquiry identity.
 * Cross-tenant matches are rejected inside the pure resolver.
 */
export async function resolveCalendarPersonIdentityForEvent(
  input: ResolveCalendarPersonIdentityForEventInput,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; resolution: CalendarPersonIdentityResolution; googleEventId: string | null }
  | { ok: false; error: string }
> {
  const tenantId = input.tenantId.trim();
  const eventId = input.eventId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const { data: event, error } = await supabase
    .from("fi_calendar_events")
    .select(
      "id, tenant_id, external_event_id, title, patient_id, lead_id, consultation_id, person_id, metadata"
    )
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !event) {
    return { ok: false, error: error?.message ?? "Calendar event not found." };
  }

  const row = event as {
    id: string;
    tenant_id: string;
    external_event_id: string | null;
    title: string;
    patient_id: string | null;
    lead_id: string | null;
    consultation_id: string | null;
    person_id: string | null;
    metadata: Record<string, unknown>;
  };

  const meta = row.metadata ?? {};
  const consultationId =
    row.consultation_id?.trim() ||
    readMetaString(meta, "consultation_id", "fi_consultation_id") ||
    null;
  const enquiryId =
    row.lead_id?.trim() || readMetaString(meta, "lead_id", "enquiry_id", "crm_lead_id") || null;
  const contactId =
    row.person_id?.trim() || readMetaString(meta, "person_id", "contact_id") || null;

  const appointmentId =
    readMetaString(meta, "fios_appointment_id", "fi_booking_id") || null;

  let appointmentPatientId: string | null = null;
  let appointmentContactId: string | null = null;
  if (appointmentId) {
    const { data: booking } = await supabase
      .from("fi_bookings")
      .select("patient_id, person_id, lead_id")
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (booking) {
      appointmentPatientId = (booking as { patient_id: string | null }).patient_id?.trim() || null;
      appointmentContactId = (booking as { person_id: string | null }).person_id?.trim() || null;
    }
  }

  let consultation: {
    id: string;
    tenantId: string;
    patientId?: string | null;
    contactId?: string | null;
    enquiryId?: string | null;
    displayName?: string | null;
  } | null = null;

  if (consultationId) {
    const { data: c } = await supabase
      .from("fi_consultations")
      .select("id, tenant_id, patient_id, person_id, lead_id")
      .eq("id", consultationId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (c) {
      const cr = c as {
        id: string;
        tenant_id: string;
        patient_id: string | null;
        person_id: string | null;
        lead_id: string | null;
      };
      let displayName: string | null = null;
      if (cr.person_id) {
        const { data: person } = await supabase
          .from("fi_persons")
          .select("metadata")
          .eq("id", cr.person_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        displayName = personDisplayName(
          (person as { metadata?: Record<string, unknown> } | null)?.metadata
        );
      }
      consultation = {
        id: cr.id,
        tenantId: cr.tenant_id,
        patientId: cr.patient_id,
        contactId: cr.person_id,
        enquiryId: cr.lead_id,
        displayName,
      };
    }
  }

  let enquiry: {
    id: string;
    tenantId: string;
    patientId?: string | null;
    contactId?: string | null;
    displayName?: string | null;
  } | null = null;

  if (enquiryId) {
    const { data: lead } = await supabase
      .from("fi_crm_leads")
      .select("id, tenant_id, patient_id, person_id, summary")
      .eq("id", enquiryId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (lead) {
      const lr = lead as {
        id: string;
        tenant_id: string;
        patient_id: string | null;
        person_id: string | null;
        summary: string | null;
      };
      let displayName = lr.summary?.trim() || null;
      if (lr.person_id) {
        const { data: person } = await supabase
          .from("fi_persons")
          .select("metadata")
          .eq("id", lr.person_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        displayName =
          personDisplayName(
            (person as { metadata?: Record<string, unknown> } | null)?.metadata
          ) || displayName;
      }
      enquiry = {
        id: lr.id,
        tenantId: lr.tenant_id,
        patientId: lr.patient_id,
        contactId: lr.person_id,
        displayName,
      };
    }
  }

  const verifiedEmail = verifiedCalendarIdentityEmail(
    readMetaString(meta, "attendee_email", "patient_email", "verified_email")
  );
  const verifiedPhone = normalizeCalendarIdentityPhone(
    readMetaString(meta, "attendee_phone", "patient_phone", "verified_phone")
  );

  const emailMatches: CalendarIdentityCandidate[] = [];
  const phoneMatches: CalendarIdentityCandidate[] = [];

  if (verifiedEmail || verifiedPhone) {
    const { data: patients } = await supabase
      .from("fi_patients")
      .select("id, person_id, tenant_id, metadata")
      .eq("tenant_id", tenantId)
      .limit(500);

    for (const p of (patients ?? []) as Array<{
      id: string;
      person_id: string;
      tenant_id: string;
      metadata: Record<string, unknown> | null;
    }>) {
      const m = p.metadata ?? {};
      const email = verifiedCalendarIdentityEmail(
        typeof m.email === "string"
          ? m.email
          : typeof m.email_normalized === "string"
            ? m.email_normalized
            : null
      );
      const phone = normalizeCalendarIdentityPhone(
        typeof m.phone === "string" ? m.phone : null
      );
      const first = typeof m.first_name === "string" ? m.first_name : "";
      const last =
        typeof m.last_name === "string"
          ? m.last_name
          : typeof m.surname === "string"
            ? m.surname
            : "";
      const displayName =
        [first, last].filter(Boolean).join(" ").trim() ||
        (typeof m.display_name === "string" ? m.display_name : null);
      const cand: CalendarIdentityCandidate = {
        kind: "patient",
        id: p.id,
        tenantId: p.tenant_id,
        patientId: p.id,
        contactId: p.person_id,
        displayName,
        email,
        phone,
      };
      if (verifiedEmail && email && email === verifiedEmail) emailMatches.push(cand);
      if (verifiedPhone && phone && phone === verifiedPhone) phoneMatches.push(cand);
    }

    // Consultation persons with matching email/phone (patient record pending).
    const { data: consultations } = await supabase
      .from("fi_consultations")
      .select("id, tenant_id, patient_id, person_id, lead_id")
      .eq("tenant_id", tenantId)
      .is("patient_id", null)
      .not("person_id", "is", null)
      .limit(200);

    const personIds = [
      ...new Set(
        ((consultations ?? []) as Array<{ person_id: string | null }>)
          .map((c) => c.person_id?.trim())
          .filter(Boolean) as string[]
      ),
    ];

    const personById = new Map<string, Record<string, unknown>>();
    if (personIds.length > 0) {
      const { data: persons } = await supabase
        .from("fi_persons")
        .select("id, metadata")
        .eq("tenant_id", tenantId)
        .in("id", personIds);
      for (const person of (persons ?? []) as Array<{
        id: string;
        metadata: Record<string, unknown> | null;
      }>) {
        personById.set(person.id, person.metadata ?? {});
      }
    }

    for (const c of (consultations ?? []) as Array<{
      id: string;
      tenant_id: string;
      patient_id: string | null;
      person_id: string | null;
      lead_id: string | null;
    }>) {
      const pid = c.person_id?.trim();
      if (!pid) continue;
      const pm = personById.get(pid) ?? {};
      const contact = displayFromPersonMetadata(pm);
      const email = verifiedCalendarIdentityEmail(contact.email);
      const phone = normalizeCalendarIdentityPhone(contact.phone);
      const cand: CalendarIdentityCandidate = {
        kind: "consultation",
        id: c.id,
        tenantId: c.tenant_id,
        consultationId: c.id,
        enquiryId: c.lead_id,
        contactId: pid,
        displayName: contact.name !== "—" ? contact.name : null,
        email,
        phone,
      };
      if (verifiedEmail && email && email === verifiedEmail) emailMatches.push(cand);
      if (verifiedPhone && phone && phone === verifiedPhone) phoneMatches.push(cand);
    }
  }

  let verifiedExternalMapping: {
    patientId: string;
    displayName?: string | null;
    contactId?: string | null;
  } | null = null;
  const verifiedRaw = Array.isArray(meta.verified_patient_mappings)
    ? (meta.verified_patient_mappings as Array<Record<string, unknown>>)
    : [];
  const extId = row.external_event_id?.trim();
  if (extId) {
    for (const m of verifiedRaw) {
      if (String(m.external_id ?? m.externalId ?? "").trim() === extId) {
        const patientId = String(m.patient_id ?? m.patientId ?? "").trim();
        if (patientId) {
          verifiedExternalMapping = {
            patientId,
            displayName: typeof m.display_name === "string" ? m.display_name : null,
            contactId: typeof m.person_id === "string" ? m.person_id : null,
          };
          break;
        }
      }
    }
  }

  const beforeState =
    typeof meta.person_identity_state === "string" ? meta.person_identity_state : null;

  const resolution = resolveCalendarPersonIdentity({
    tenantId,
    explicitPatientId: row.patient_id,
    explicitConsultationId: consultationId,
    explicitEnquiryId: enquiryId,
    explicitContactId: contactId,
    appointmentPatientId,
    appointmentContactId,
    consultation,
    enquiry,
    verifiedEmail,
    verifiedPhone,
    emailMatches,
    phoneMatches,
    verifiedExternalMapping,
    nameOnlySuggestions: [],
    externalDisplayTitle: row.title?.trim() || null,
    protectExistingExplicitPatientMapping: true,
  });

  if (input.persistResolution) {
    const nextMeta: Record<string, unknown> = {
      ...meta,
      person_identity_state: resolution.identityState,
      identity_match_method: resolution.matchEvidence.method,
      identity_match_confidence: resolution.matchEvidence.confidence,
      identity_resolved_at: new Date().toISOString(),
      ...(resolution.consultationId ? { consultation_id: resolution.consultationId } : {}),
      ...(resolution.enquiryId ? { enquiry_id: resolution.enquiryId } : {}),
      external_display_title: resolution.externalDisplayTitle,
    };
    await supabase
      .from("fi_calendar_events")
      .update({
        consultation_id: resolution.consultationId,
        person_id: resolution.contactId,
        metadata: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("tenant_id", tenantId);
  }

  logStructured("info", "calendar_identity_resolution", {
    tenantId,
    eventId,
    googleEventId: row.external_event_id,
    identityStateBefore: beforeState,
    identityStateAfter: resolution.identityState,
    consultationId: resolution.consultationId,
    enquiryId: resolution.enquiryId,
    contactId: resolution.contactId,
    patientId: resolution.patientId,
    appointmentId,
    matchMethod: resolution.matchEvidence.method,
    actingUserId: input.actingUserId ?? null,
    interactionSource: "calendar_identity_resolution",
  });

  return { ok: true, resolution, googleEventId: row.external_event_id };
}

/**
 * Identity search for Link patient: patients, consultations, enquiries/contacts,
 * plus verified email/phone hits for the event.
 */
export async function searchCalendarIdentityLinkCandidates(
  input: {
    tenantId: string;
    eventId: string;
    query: string;
  },
  opts: ServerOpts = {}
): Promise<
  | {
      ok: true;
      patients: CalendarIdentityCandidate[];
      consultations: CalendarIdentityCandidate[];
      enquiries: CalendarIdentityCandidate[];
      verifiedMatches: CalendarIdentityCandidate[];
    }
  | { ok: false; error: string }
> {
  const tenantId = input.tenantId.trim();
  const query = input.query.trim().slice(0, 120);
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const resolved = await resolveCalendarPersonIdentityForEvent(
    { tenantId, eventId: input.eventId },
    opts
  );
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const verifiedMatches = resolved.resolution.suggestions.filter(
    (s) =>
      s.kind === "patient" ||
      resolved.resolution.matchEvidence.method === "exact_verified_email" ||
      resolved.resolution.matchEvidence.method === "exact_verified_phone"
  );

  if (
    resolved.resolution.patientId &&
    resolved.resolution.identityState === "patient_linked" &&
    verifiedMatches.length === 0
  ) {
    verifiedMatches.push({
      kind: "patient",
      id: resolved.resolution.patientId,
      tenantId,
      patientId: resolved.resolution.patientId,
      contactId: resolved.resolution.contactId,
      displayName: resolved.resolution.displayName,
      consultationId: resolved.resolution.consultationId,
      enquiryId: resolved.resolution.enquiryId,
    });
  }

  if (!query) {
    // Still surface known consultation identity when query empty.
    const consultations: CalendarIdentityCandidate[] = [];
    if (resolved.resolution.consultationId) {
      consultations.push({
        kind: "consultation",
        id: resolved.resolution.consultationId,
        tenantId,
        consultationId: resolved.resolution.consultationId,
        contactId: resolved.resolution.contactId,
        enquiryId: resolved.resolution.enquiryId,
        displayName: resolved.resolution.displayName,
        label: resolved.resolution.displayName
          ? `${resolved.resolution.displayName} — New consultation — Patient record pending`
          : undefined,
      });
    }
    return {
      ok: true,
      patients: [],
      consultations,
      enquiries: [],
      verifiedMatches,
    };
  }

  const q = query.toLowerCase();
  const patients: CalendarIdentityCandidate[] = [];
  const consultations: CalendarIdentityCandidate[] = [];
  const enquiries: CalendarIdentityCandidate[] = [];

  const { data: patientRows } = await supabase
    .from("fi_patients")
    .select("id, person_id, tenant_id, metadata")
    .eq("tenant_id", tenantId)
    .limit(200);

  for (const p of (patientRows ?? []) as Array<{
    id: string;
    person_id: string;
    tenant_id: string;
    metadata: Record<string, unknown> | null;
  }>) {
    const m = p.metadata ?? {};
    const first = typeof m.first_name === "string" ? m.first_name : "";
    const last =
      typeof m.last_name === "string" ? m.last_name : typeof m.surname === "string" ? m.surname : "";
    const displayName =
      [first, last].filter(Boolean).join(" ").trim() ||
      (typeof m.display_name === "string" ? m.display_name : "") ||
      "";
    const email =
      typeof m.email === "string"
        ? m.email
        : typeof m.email_normalized === "string"
          ? m.email_normalized
          : "";
    const phone = typeof m.phone === "string" ? m.phone : "";
    const blob = `${displayName} ${email} ${phone} ${p.id}`.toLowerCase();
    if (!blob.includes(q)) continue;
    patients.push({
      kind: "patient",
      id: p.id,
      tenantId: p.tenant_id,
      patientId: p.id,
      contactId: p.person_id,
      displayName: displayName || null,
      email: email || null,
      phone: phone || null,
    });
    if (patients.length >= 20) break;
  }

  const { data: consultationRows } = await supabase
    .from("fi_consultations")
    .select("id, tenant_id, patient_id, person_id, lead_id")
    .eq("tenant_id", tenantId)
    .limit(200);

  const consultPersonIds = [
    ...new Set(
      ((consultationRows ?? []) as Array<{ person_id: string | null }>)
        .map((c) => c.person_id?.trim())
        .filter(Boolean) as string[]
    ),
  ];
  const personMeta = new Map<string, Record<string, unknown>>();
  if (consultPersonIds.length > 0) {
    const { data: persons } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("id", consultPersonIds);
    for (const person of (persons ?? []) as Array<{
      id: string;
      metadata: Record<string, unknown> | null;
    }>) {
      personMeta.set(person.id, person.metadata ?? {});
    }
  }

  for (const c of (consultationRows ?? []) as Array<{
    id: string;
    tenant_id: string;
    patient_id: string | null;
    person_id: string | null;
    lead_id: string | null;
  }>) {
    const pm = c.person_id ? personMeta.get(c.person_id) ?? {} : {};
    const contact = displayFromPersonMetadata(pm);
    const blob = `${contact.name} ${contact.email ?? ""} ${contact.phone ?? ""} ${c.id}`.toLowerCase();
    if (!blob.includes(q) && !c.id.toLowerCase().includes(q)) continue;
    // Prefer showing consultations that still need patient promotion.
    if (c.patient_id?.trim()) continue;
    consultations.push({
      kind: "consultation",
      id: c.id,
      tenantId: c.tenant_id,
      consultationId: c.id,
      contactId: c.person_id,
      enquiryId: c.lead_id,
      displayName: contact.name !== "—" ? contact.name : null,
      email: contact.email,
      phone: contact.phone,
      label:
        contact.name !== "—"
          ? `${contact.name} — New consultation — Patient record pending`
          : "New consultation — Patient record pending",
    });
    if (consultations.length >= 20) break;
  }

  const { data: leadRows } = await supabase
    .from("fi_crm_leads")
    .select("id, tenant_id, patient_id, person_id, summary")
    .eq("tenant_id", tenantId)
    .limit(100);

  for (const lead of (leadRows ?? []) as Array<{
    id: string;
    tenant_id: string;
    patient_id: string | null;
    person_id: string | null;
    summary: string | null;
  }>) {
    let displayName = lead.summary?.trim() || null;
    let email: string | null = null;
    let phone: string | null = null;
    if (lead.person_id) {
      if (!personMeta.has(lead.person_id)) {
        const { data: person } = await supabase
          .from("fi_persons")
          .select("metadata")
          .eq("id", lead.person_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        personMeta.set(
          lead.person_id,
          (person as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}
        );
      }
      const contact = displayFromPersonMetadata(personMeta.get(lead.person_id) ?? {});
      displayName = contact.name !== "—" ? contact.name : displayName;
      email = contact.email;
      phone = contact.phone;
    }
    const blob = `${displayName ?? ""} ${email ?? ""} ${phone ?? ""} ${lead.id}`.toLowerCase();
    if (!blob.includes(q)) continue;
    enquiries.push({
      kind: "enquiry",
      id: lead.id,
      tenantId: lead.tenant_id,
      enquiryId: lead.id,
      patientId: lead.patient_id,
      contactId: lead.person_id,
      displayName,
      email,
      phone,
    });
    if (enquiries.length >= 20) break;
  }

  return { ok: true, patients, consultations, enquiries, verifiedMatches };
}
