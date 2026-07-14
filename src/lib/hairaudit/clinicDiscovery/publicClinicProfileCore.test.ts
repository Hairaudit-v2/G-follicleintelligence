import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveHairAuditLinkForSurgery } from "@/src/lib/outcomeIntelligence/hairAuditLinkCore";
import {
  buildPublicClinicProfileFromFiOsClinic,
  buildPublicClinicProfileFromHairAuditClinic,
  resolveHybridPublicClinicProfile,
  toPublicClinicSearchDocument,
  assertPublicClinicSearchDocumentHasNoSensitiveFields,
} from "./publicClinicProfileCore";
import {
  aggregatePublicClinicProfileSyncSummary,
  planPublicClinicProfileSyncItem,
} from "./publicClinicProfileSyncCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CLINIC = "22222222-2222-4222-8222-222222222222";
const HAIRAUDIT_CLINIC = "hairaudit-clinic-001";
const LEGACY_HAIRAUDIT = "66666666-6666-4666-8666-666666666666";
const REPORT = "77777777-7777-4777-8777-777777777777";

describe("publicClinicProfileCore", () => {
  it("FI OS clinic not visible by default", () => {
    const profile = buildPublicClinicProfileFromFiOsClinic({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Perth Hair Clinic",
      settings: {
        phone: "+61 8 0000 0000",
        email: "info@example.com",
        address: "Perth, WA, Australia",
      },
    });

    assert.equal(profile.public_profile_enabled, false);
    assert.equal(profile.search_visible, false);
    assert.equal(toPublicClinicSearchDocument(profile), null);
  });

  it("opted-in FI OS clinic creates public profile", () => {
    const profile = buildPublicClinicProfileFromFiOsClinic({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Perth Hair Clinic",
      discoverySettings: {
        public_profile_enabled: true,
        search_visible: true,
        accepts_independent_hairaudit_enquiries: true,
        clinic_name: "Perth Hair Clinic",
        city_suburb: "Perth",
        state_region: "WA",
        country: "Australia",
        public_phone: null,
        public_email: null,
        public_website_url: null,
        public_booking_url: "https://example.com/book",
        logo_brand_image_url: null,
        services_offered: ["FUE", "FUT"],
        profile_summary: "Hair restoration clinic",
        profile_bio: null,
      },
    });

    assert.equal(profile.public_profile_enabled, true);
    assert.equal(profile.search_visible, true);
    const search = toPublicClinicSearchDocument(profile);
    assert.ok(search);
    assert.equal(search.clinic_name, "Perth Hair Clinic");
    assert.deepEqual(search.services_offered, ["FUE", "FUT"]);
  });

  it("HairAudit standalone clinic creates public profile", () => {
    const profile = buildPublicClinicProfileFromHairAuditClinic({
      hairauditClinicId: HAIRAUDIT_CLINIC,
      clinicName: "Standalone HairAudit Clinic",
      citySuburb: "Sydney",
      stateRegion: "NSW",
      country: "Australia",
      discoverySettings: {
        public_profile_enabled: true,
        search_visible: true,
        accepts_independent_hairaudit_enquiries: true,
        clinic_name: "Standalone HairAudit Clinic",
        city_suburb: "Sydney",
        state_region: "NSW",
        country: "Australia",
        public_phone: null,
        public_email: "hello@standalone.example",
        public_website_url: "https://standalone.example",
        public_booking_url: null,
        logo_brand_image_url: null,
        services_offered: ["Consultation"],
        profile_summary: null,
        profile_bio: null,
      },
      auditVerified: true,
    });

    assert.equal(profile.audit_source, "hairaudit");
    assert.equal(profile.tenant_id, null);
    assert.equal(profile.hairaudit_clinic_id, HAIRAUDIT_CLINIC);
    assert.equal(profile.audit_verified, true);
  });

  it("hybrid clinic deduplicates safely", () => {
    const fiProfile = buildPublicClinicProfileFromFiOsClinic({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Hybrid Clinic",
      hairauditClinicId: HAIRAUDIT_CLINIC,
      discoverySettings: {
        public_profile_enabled: true,
        search_visible: false,
        accepts_independent_hairaudit_enquiries: false,
        clinic_name: "Hybrid Clinic",
        city_suburb: "Melbourne",
        state_region: "VIC",
        country: "Australia",
        public_phone: null,
        public_email: null,
        public_website_url: null,
        public_booking_url: null,
        logo_brand_image_url: null,
        services_offered: [],
        profile_summary: null,
        profile_bio: null,
      },
    });

    const hairauditProfile = buildPublicClinicProfileFromHairAuditClinic({
      hairauditClinicId: HAIRAUDIT_CLINIC,
      clinicName: "HairAudit Name",
      auditVerified: true,
      lastAuditActivityAt: "2026-07-01T10:00:00.000Z",
    });

    const merged = resolveHybridPublicClinicProfile({
      fiProfile,
      hairauditProfile,
      explicitLink: { fiClinicId: CLINIC, hairauditClinicId: HAIRAUDIT_CLINIC },
    });

    assert.ok(merged);
    assert.equal(merged.audit_source, "hybrid");
    assert.equal(merged.fi_clinic_id, CLINIC);
    assert.equal(merged.hairaudit_clinic_id, HAIRAUDIT_CLINIC);
    assert.equal(merged.audit_verified, true);
  });

  it("no patient/case/report data is exposed", () => {
    const profile = buildPublicClinicProfileFromFiOsClinic({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Safe Clinic",
      discoverySettings: {
        public_profile_enabled: true,
        search_visible: true,
        accepts_independent_hairaudit_enquiries: false,
        clinic_name: "Safe Clinic",
        city_suburb: "Perth",
        state_region: "WA",
        country: "Australia",
        public_phone: null,
        public_email: null,
        public_website_url: null,
        public_booking_url: null,
        logo_brand_image_url: null,
        services_offered: [],
        profile_summary: null,
        profile_bio: null,
      },
    });

    const search = toPublicClinicSearchDocument(profile);
    assert.ok(search);
    const violations = assertPublicClinicSearchDocumentHasNoSensitiveFields(
      search as unknown as Record<string, unknown>
    );
    assert.deepEqual(violations, []);
    assert.equal("tenant_id" in search, false);
    assert.equal("patient_id" in search, false);
    assert.equal("report_id" in search, false);
  });

  it("disabling search hides profile", () => {
    const profile = buildPublicClinicProfileFromFiOsClinic({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Hidden Clinic",
      discoverySettings: {
        public_profile_enabled: true,
        search_visible: false,
        accepts_independent_hairaudit_enquiries: false,
        clinic_name: "Hidden Clinic",
        city_suburb: "Perth",
        state_region: "WA",
        country: "Australia",
        public_phone: null,
        public_email: null,
        public_website_url: null,
        public_booking_url: null,
        logo_brand_image_url: null,
        services_offered: [],
        profile_summary: null,
        profile_bio: null,
      },
    });

    assert.equal(toPublicClinicSearchDocument(profile), null);
  });

  it("legacy HairAudit links still resolve unchanged", () => {
    const resolution = resolveHairAuditLinkForSurgery({
      tenantId: TENANT,
      surgeryId: "44444444-4444-4444-8444-444444444444",
      caseMetadata: {
        hairaudit_case_id: LEGACY_HAIRAUDIT,
        report_id: REPORT,
      },
    });
    assert.equal(resolution.hairaudit_case_id, LEGACY_HAIRAUDIT);
    assert.equal(resolution.fi_report_id, REPORT);
    assert.equal(resolution.hrefs.audit_report_href, `/fi-admin/${TENANT}/audit/${REPORT}`);
  });

  it("dry-run does not write", () => {
    const planned = planPublicClinicProfileSyncItem({
      tenantId: TENANT,
      fiClinicId: CLINIC,
      clinicDisplayName: "Dry Run Clinic",
      dryRun: true,
      discoveryInput: {
        tenantId: TENANT,
        fiClinicId: CLINIC,
        clinicDisplayName: "Dry Run Clinic",
      },
    });
    assert.equal(planned.outcome.kind, "dry_run_would_create");
    const summary = aggregatePublicClinicProfileSyncSummary([planned.outcome], true);
    assert.equal(summary.dryRun, true);
    assert.equal(summary.wouldCreate, 1);
    assert.equal(summary.created, 0);
  });
});
