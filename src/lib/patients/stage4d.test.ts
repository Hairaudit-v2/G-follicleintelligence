import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientTimeline } from "./timeline/patientTimelineBuild";
import {
  filterPatientTimelineItems,
  groupPatientTimelineByPeriod,
  sortPatientTimelineItems,
} from "./timeline/patientTimelineFilters";
import type { PatientTimelineSourceBundle } from "./timeline/patientTimelineTypes";

const href = { tenantId: "tid-1" };

function minimalBundle(
  over: Partial<PatientTimelineSourceBundle> = {}
): PatientTimelineSourceBundle {
  const base: PatientTimelineSourceBundle = {
    tenantId: "tid-1",
    foundationPatientId: "patient-1",
    patient: {
      id: "patient-1",
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-01T10:00:00.000Z",
      patient_status: "active",
    },
    leads: [],
    cases: [],
    bookings: [],
    activity: [],
    clinical: null,
    images: [],
  };
  return { ...base, ...over };
}

describe("Stage 4D — patient treatment timeline (pure)", () => {
  it("builds deterministic ids and sorts newest first by default", () => {
    const bundle = minimalBundle({
      leads: [
        {
          id: "lead-a",
          created_at: "2026-02-01T12:00:00.000Z",
          updated_at: "2026-02-02T12:00:00.000Z",
          status: "open",
          converted_at: null,
          converted_case_id: null,
          current_stage_id: null,
          stageLabel: null,
        },
      ],
      bookings: [
        {
          id: "book-1",
          booking_type: "consultation",
          booking_status: "scheduled",
          title: "SECRET TITLE",
          start_at: "2026-03-10T15:00:00.000Z",
          lead_id: "lead-a",
          case_id: null,
          created_at: "2026-02-10T09:00:00.000Z",
          updated_at: "2026-02-10T09:00:00.000Z",
          cancelled_at: null,
        },
      ],
    });
    const newest = buildPatientTimeline(bundle, { hrefContext: href, sort: "newest_first" });
    assert.ok(newest.items.length >= 2);
    for (let i = 1; i < newest.items.length; i++) {
      assert.ok(
        Date.parse(newest.items[i - 1]!.occurred_at) >= Date.parse(newest.items[i]!.occurred_at)
      );
    }
    assert.ok(newest.items.some((i) => i.id === "lead_created:lead-a"));
    assert.ok(newest.items.some((i) => i.id === "booking_scheduled:book-1"));
    const bookingItem = newest.items.find((i) => i.id === "booking_scheduled:book-1");
    assert.equal(bookingItem?.subtitle, null);
    assert.equal(bookingItem?.title.includes("SECRET"), false);
  });

  it("oldest-first sort option", () => {
    const bundle = minimalBundle({
      cases: [
        {
          id: "case-1",
          status: "draft",
          case_type: "hairaudit",
          created_at: "2026-01-05T00:00:00.000Z",
          sourceLeadId: null,
        },
      ],
      leads: [
        {
          id: "lead-a",
          created_at: "2026-01-10T00:00:00.000Z",
          updated_at: "2026-01-10T00:00:00.000Z",
          status: "open",
          converted_at: null,
          converted_case_id: null,
          current_stage_id: null,
          stageLabel: null,
        },
      ],
    });
    const oldest = buildPatientTimeline(bundle, { hrefContext: href, sort: "oldest_first" });
    assert.equal(oldest.items[0]?.id, "case_created:case-1");
  });

  it("links patient-only CRM activity to the patient profile route", () => {
    const bundle = minimalBundle({
      activity: [
        {
          id: "act-br",
          occurred_at: "2026-05-01T12:00:00.000Z",
          activity_kind: "pathology.blood_request.created",
          title: "Blood request created",
          lead_id: null,
          case_id: null,
          patient_id: "patient-1",
          detail: { template_used: "hair_loss_investigation", test_count: 3 },
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href });
    const row = items.find((i) => i.id === "crm_activity:act-br");
    assert.ok(row);
    assert.equal(row!.href, "/fi-admin/tid-1/patients/patient-1");
    assert.equal(row!.title, "Blood request created");
  });

  it("does not leak note bodies or admin narrative via CRM activity titles", () => {
    const bundle = minimalBundle({
      leads: [
        {
          id: "lead-a",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          status: "open",
          converted_at: null,
          converted_case_id: null,
          current_stage_id: null,
          stageLabel: null,
        },
      ],
      activity: [
        {
          id: "act-1",
          occurred_at: "2026-04-01T00:00:00.000Z",
          activity_kind: "lead_note.created",
          title: "Patient admitted suicidal ideation and full clinical note text here",
          lead_id: "lead-a",
          case_id: null,
          patient_id: "patient-1",
          detail: { note_id: "n1", note_visibility: "team" },
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href });
    const row = items.find((i) => i.id === "crm_activity:act-1");
    assert.ok(row);
    assert.equal(row!.title.includes("suicidal"), false);
    assert.equal(row!.title.includes("clinical note"), false);
    assert.equal(row!.is_sensitive, true);
    assert.equal(row!.metadata_summary, "Note activity");
  });

  it("filters by item type and source type", () => {
    const bundle = minimalBundle({
      leads: [
        {
          id: "lead-a",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          status: "open",
          converted_at: null,
          converted_case_id: null,
          current_stage_id: null,
          stageLabel: null,
        },
      ],
      cases: [
        {
          id: "case-1",
          status: "draft",
          case_type: null,
          created_at: "2026-02-01T00:00:00.000Z",
          sourceLeadId: "lead-a",
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href, limit: 500 });
    const onlyCases = filterPatientTimelineItems(items, {
      itemTypes: ["case_created"],
      sourceTypes: null,
    });
    assert.ok(onlyCases.every((i) => i.item_type === "case_created"));
    const onlyLeadSource = filterPatientTimelineItems(items, {
      itemTypes: null,
      sourceTypes: ["lead"],
    });
    assert.ok(onlyLeadSource.every((i) => i.source_type === "lead"));
  });

  it("groups all distant events into earlier bucket", () => {
    const nowIso = "2026-06-05T14:00:00.000Z";
    const items = sortPatientTimelineItems(
      [
        {
          id: "a",
          occurred_at: "2000-01-01T10:00:00.000Z",
          item_type: "other",
          title: "t",
          subtitle: null,
          source_type: "system",
          source_id: "x",
          severity: null,
          href: null,
          metadata_summary: null,
          is_sensitive: false,
        },
        {
          id: "b",
          occurred_at: "2000-06-01T10:00:00.000Z",
          item_type: "other",
          title: "t",
          subtitle: null,
          source_type: "system",
          source_id: "y",
          severity: null,
          href: null,
          metadata_summary: null,
          is_sensitive: false,
        },
      ],
      "newest_first"
    );
    const g = groupPatientTimelineByPeriod(items, nowIso);
    assert.equal(g.today.length + g.this_week.length, 0);
    assert.equal(g.earlier.length, 2);
  });

  it("applies limit and hasMore", () => {
    const leads = Array.from({ length: 30 }).map((_, i) => ({
      id: `lead-${i}`,
      created_at: `2026-01-${String((i % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
      updated_at: `2026-01-${String((i % 27) + 1).padStart(2, "0")}T12:00:00.000Z`,
      status: "open",
      converted_at: null as string | null,
      converted_case_id: null as string | null,
      current_stage_id: null as string | null,
      stageLabel: null as string | null,
    }));
    const bundle = minimalBundle({ leads });
    const page = buildPatientTimeline(bundle, { hrefContext: href, limit: 10, offset: 0 });
    assert.equal(page.items.length, 10);
    assert.equal(page.hasMore, true);
  });
});
