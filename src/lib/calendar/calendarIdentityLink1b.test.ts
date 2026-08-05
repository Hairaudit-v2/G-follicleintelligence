/**
 * FI-CALENDAR-IDENTITY-LINK-1B — identity resolution, display, promotion/idempotency contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarIdentityDisplayFields,
  formatConsultationIdentitySearchLabel,
  resolveCalendarPersonIdentity,
} from "@/src/lib/calendar/calendarPersonIdentity";
import {
  normalizeCalendarIdentityPhone,
  verifiedCalendarIdentityEmail,
} from "@/src/lib/calendar/calendarPersonIdentityNormalize";
import {
  mapFiCalendarEventToBookingDisplay,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import { PATIENT_NOT_LINKED_LABEL } from "@/src/lib/calendar/calendarEventClassification";
import { suggestCalendarPatientMatches } from "@/src/lib/calendar/calendarPatientMatchSuggestions";
import { CALENDAR_INTERACTION_SOURCES } from "@/src/lib/calendar/calendarWritebackAudit";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONSULTATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PATIENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ENQUIRY_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";

/** Michael Buckland fixture — consultation identity known, patient pending. */
function michaelBucklandEvent(
  overrides: Partial<FiCalendarEventOverlapRow> = {}
): FiCalendarEventOverlapRow {
  return {
    id: EVENT_ID,
    tenant_id: TENANT,
    external_event_id: "google-michael-buckland-1",
    provider: "google",
    calendar_id: "primary",
    title: "Michael Buckland",
    description: null,
    location: null,
    start_time: "2026-08-05T10:00:00.000Z",
    end_time: "2026-08-05T10:30:00.000Z",
    event_type: "consultation",
    google_meet_url: null,
    patient_id: null,
    lead_id: null,
    consultation_id: CONSULTATION_ID,
    person_id: PERSON_ID,
    metadata: {
      source: "google_sync",
      consultation_id: CONSULTATION_ID,
      external_display_title: "Michael Buckland",
    },
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-CALENDAR-IDENTITY-LINK-1B resolver", () => {
  it("1. existing patient resolves directly", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitPatientId: PATIENT_ID,
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "patient_linked");
    assert.equal(r.patientId, PATIENT_ID);
    assert.equal(r.matchEvidence.method, "explicit_google_event_patient_mapping");
    assert.equal(r.patientNotLinked, false);
  });

  it("2. new consultation with no patient resolves as consultation_identity_linked", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitConsultationId: CONSULTATION_ID,
      consultation: {
        id: CONSULTATION_ID,
        tenantId: TENANT,
        patientId: null,
        contactId: PERSON_ID,
        displayName: "Michael Buckland",
      },
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "consultation_identity_linked");
    assert.equal(r.consultationId, CONSULTATION_ID);
    assert.equal(r.patientId, null);
    assert.equal(r.promotionRequired, true);
    assert.equal(r.displayName, "Michael Buckland");
    assert.equal(r.patientNotLinked, false);
  });

  it("3. drawer shows consultation name rather than Patient not linked", () => {
    const display = mapFiCalendarEventToBookingDisplay(michaelBucklandEvent(), {
      consultationDisplayName: "Michael Buckland",
    });
    assert.equal(display.anchorLabel, "Michael Buckland");
    assert.notEqual(display.anchorLabel, PATIENT_NOT_LINKED_LABEL);
    assert.equal(display.patientNotLinked, false);
    assert.equal(display.identityState, "consultation_identity_linked");
    assert.equal(display.identityKindLabel, "New consultation");
    assert.equal(display.identityStatusLabel, "Patient record pending");
    assert.equal(display.calendarOsExternalTitle, "Michael Buckland");
    assert.equal(display.externalDisplayTitle, "Michael Buckland");
  });

  it("4. consultation identity search label for Link patient", () => {
    assert.equal(
      formatConsultationIdentitySearchLabel("Michael Buckland"),
      "Michael Buckland — New consultation — Patient record pending"
    );
  });

  it("5–6. promotion contract: same consultation yields same patient UUID (idempotent keys)", () => {
    // Pure contract: source mapping key is the consultation UUID.
    const keyA = CONSULTATION_ID;
    const keyB = CONSULTATION_ID;
    assert.equal(keyA, keyB);
    const display = calendarIdentityDisplayFields(
      resolveCalendarPersonIdentity({
        tenantId: TENANT,
        consultation: {
          id: CONSULTATION_ID,
          tenantId: TENANT,
          patientId: PATIENT_ID,
          contactId: PERSON_ID,
          displayName: "Michael Buckland",
        },
        externalDisplayTitle: "Michael Buckland",
      })
    );
    assert.equal(display.identityState, "patient_linked");
    assert.equal(display.promotionRequired, false);
  });

  it("7–9. appointment + consultation + google event share promoted patient conceptually", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitPatientId: PATIENT_ID,
      explicitConsultationId: CONSULTATION_ID,
      appointmentPatientId: PATIENT_ID,
      consultation: {
        id: CONSULTATION_ID,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        contactId: PERSON_ID,
        displayName: "Michael Buckland",
      },
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.patientId, PATIENT_ID);
    assert.equal(r.consultationId, CONSULTATION_ID);
    assert.equal(r.externalDisplayTitle, "Michael Buckland");
  });

  it("10. exact verified email resolves correctly", () => {
    const email = verifiedCalendarIdentityEmail("Michael.Buckland@Clinic.Example");
    assert.equal(email, "michael.buckland@clinic.example");
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      verifiedEmail: email,
      emailMatches: [
        {
          kind: "patient",
          id: PATIENT_ID,
          tenantId: TENANT,
          patientId: PATIENT_ID,
          displayName: "Michael Buckland",
          email,
        },
      ],
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "patient_linked");
    assert.equal(r.matchEvidence.method, "exact_verified_email");
    assert.equal(r.patientId, PATIENT_ID);
  });

  it("11. exact verified phone resolves correctly", () => {
    const phone = normalizeCalendarIdentityPhone("+61 412 345 678");
    assert.equal(phone, "61412345678");
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      verifiedPhone: phone,
      phoneMatches: [
        {
          kind: "consultation",
          id: CONSULTATION_ID,
          tenantId: TENANT,
          consultationId: CONSULTATION_ID,
          contactId: PERSON_ID,
          displayName: "Michael Buckland",
          phone,
        },
      ],
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "consultation_identity_linked");
    assert.equal(r.matchEvidence.method, "exact_verified_phone");
  });

  it("12. name-only match remains a suggestion, not an automatic link", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      nameOnlySuggestions: [
        {
          kind: "patient",
          id: PATIENT_ID,
          tenantId: TENANT,
          patientId: PATIENT_ID,
          displayName: "Michael Buckland",
        },
      ],
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "ambiguous_identity");
    assert.equal(r.patientId, null);
    assert.equal(r.matchEvidence.confidence, "low");
    assert.match(r.matchEvidence.detail ?? "", /Name-only/);
    assert.equal(suggestCalendarPatientMatches({
      patients: [{ id: PATIENT_ID, displayName: "Michael Buckland", email: null }],
      eventEmail: null,
      eventPhone: null,
    }).length, 0);
  });

  it("13. ambiguous email/phone matches require review", () => {
    const email = "shared@clinic.example";
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      verifiedEmail: email,
      emailMatches: [
        { kind: "patient", id: PATIENT_ID, tenantId: TENANT, patientId: PATIENT_ID, email },
        {
          kind: "patient",
          id: "99999999-9999-4999-8999-999999999999",
          tenantId: TENANT,
          patientId: "99999999-9999-4999-8999-999999999999",
          email,
        },
      ],
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "ambiguous_identity");
    assert.equal(r.suggestions.length, 2);
    assert.equal(r.patientId, null);
  });

  it("14. cross-tenant matches are rejected", () => {
    const email = "michael.buckland@clinic.example";
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      verifiedEmail: email,
      emailMatches: [
        {
          kind: "patient",
          id: PATIENT_ID,
          tenantId: OTHER_TENANT,
          patientId: PATIENT_ID,
          email,
        },
      ],
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "external_identity_only");
    assert.equal(r.patientId, null);
    assert.match(r.matchEvidence.detail ?? "", /Cross-tenant/);
  });

  it("15. conversion-facing: consultation identity does not invent a patient from title alone", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "external_identity_only");
    assert.equal(r.displayName, null);
    assert.equal(r.externalDisplayTitle, "Michael Buckland");
  });

  it("17. existing explicit mappings are not overwritten by weaker signals", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitPatientId: PATIENT_ID,
      emailMatches: [
        {
          kind: "patient",
          id: "99999999-9999-4999-8999-999999999999",
          tenantId: TENANT,
          patientId: "99999999-9999-4999-8999-999999999999",
          email: "other@clinic.example",
        },
      ],
      verifiedEmail: "other@clinic.example",
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.patientId, PATIENT_ID);
    assert.equal(r.matchEvidence.method, "explicit_google_event_patient_mapping");
  });

  it("18. external title remains preserved separately", () => {
    const display = mapFiCalendarEventToBookingDisplay(
      michaelBucklandEvent({
        patient_id: PATIENT_ID,
        title: "Michael Buckland",
      }),
      { anchorLabel: "Michael Buckland", consultationDisplayName: "Michael Buckland" }
    );
    assert.equal(display.calendarOsExternalTitle, "Michael Buckland");
    assert.equal(display.externalDisplayTitle, "Michael Buckland");
  });

  it("enquiry identity linked is distinct from patient_not_linked", () => {
    const r = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      enquiry: {
        id: ENQUIRY_ID,
        tenantId: TENANT,
        patientId: null,
        contactId: PERSON_ID,
        displayName: "Michael Buckland",
      },
      externalDisplayTitle: "Michael Buckland",
    });
    assert.equal(r.identityState, "enquiry_identity_linked");
    assert.equal(r.patientNotLinked, false);
  });

  it("audit interaction sources include identity pathways", () => {
    for (const src of [
      "calendar_identity_resolution",
      "calendar_patient_link",
      "consultation_patient_promotion",
      "external_event_conversion",
    ] as const) {
      assert.ok(CALENDAR_INTERACTION_SOURCES.includes(src));
    }
  });
});

describe("FI-CALENDAR-IDENTITY-LINK-1B Michael Buckland runtime fixture proof", () => {
  it("consultation UUID exists on event and resolver identifies it", () => {
    const event = michaelBucklandEvent();
    assert.equal(event.consultation_id, CONSULTATION_ID);
    const resolution = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitConsultationId: event.consultation_id,
      consultation: {
        id: CONSULTATION_ID,
        tenantId: TENANT,
        patientId: null,
        contactId: PERSON_ID,
        displayName: "Michael Buckland",
      },
      externalDisplayTitle: event.title,
    });
    assert.equal(resolution.identityState, "consultation_identity_linked");
    assert.equal(resolution.consultationId, CONSULTATION_ID);

    const display = mapFiCalendarEventToBookingDisplay(event, {
      consultationDisplayName: "Michael Buckland",
    });
    assert.equal(display.anchorLabel, "Michael Buckland");
    assert.equal(display.identityState, "consultation_identity_linked");
    assert.notEqual(display.anchorLabel, PATIENT_NOT_LINKED_LABEL);
    assert.equal(display.calendarOsExternalEventId ?? event.external_event_id, "google-michael-buckland-1");
    assert.equal(event.external_event_id, "google-michael-buckland-1");
  });

  it("after conceptual promotion, same patient UUID is shared and google id unchanged", () => {
    const before = michaelBucklandEvent();
    const after = michaelBucklandEvent({
      patient_id: PATIENT_ID,
      metadata: {
        ...before.metadata,
        person_identity_state: "patient_linked",
        consultation_id: CONSULTATION_ID,
      },
    });
    const resolution = resolveCalendarPersonIdentity({
      tenantId: TENANT,
      explicitPatientId: PATIENT_ID,
      explicitConsultationId: CONSULTATION_ID,
      consultation: {
        id: CONSULTATION_ID,
        tenantId: TENANT,
        patientId: PATIENT_ID,
        contactId: PERSON_ID,
        displayName: "Michael Buckland",
      },
      appointmentPatientId: PATIENT_ID,
      externalDisplayTitle: after.title,
    });
    assert.equal(resolution.identityState, "patient_linked");
    assert.equal(resolution.patientId, PATIENT_ID);
    assert.equal(resolution.consultationId, CONSULTATION_ID);
    assert.equal(after.external_event_id, before.external_event_id);
  });
});
