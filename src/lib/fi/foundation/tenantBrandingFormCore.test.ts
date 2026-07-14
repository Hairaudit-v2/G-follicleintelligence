import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantBrandingFormInitialState,
  buildTenantBrandingPreviewDraft,
  buildTenantBrandingRevisionKey,
  computeTenantBrandingLogoControlsState,
  mergeTenantSettingsSavePayload,
  tenantBrandingHasLegacyLogoUrl,
  tenantBrandingHasUploadedLogo,
  TENANT_BRANDING_LOGO_FALLBACK_ORDER,
} from "./tenantBrandingFormCore";
import { emptyNormalizedTenantBranding } from "./tenantBrandingCore";
import type { FiTenantSettingsRow } from "./tenantSettings";

const sampleRow: FiTenantSettingsRow = {
  id: "row-1",
  tenant_id: "tenant-1",
  brand_name: "Evolved Clinics",
  logo_url: "https://legacy.example/logo.png",
  primary_colour: "#111111",
  secondary_colour: "#222222",
  accent_colour: "#333333",
  support_email: "help@example.com",
  default_timezone: "Europe/London",
  metadata: {
    logo_storage_bucket: "tenant-branding",
    logo_storage_path: "tenant-branding/t1/logo/x.png",
    logo_uploaded_at: "2026-07-05T04:00:00.000Z",
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-07-05T04:05:00.000Z",
};

describe("tenantBrandingFormCore", () => {
  it("hydrates edit fields from fi_tenant_settings columns", () => {
    const fields = buildTenantBrandingFormInitialState(sampleRow);
    assert.equal(fields.brand_name, "Evolved Clinics");
    assert.equal(fields.primary_colour, "#111111");
    assert.equal(fields.accent_colour, "#333333");
    assert.equal(fields.logo_url, "https://legacy.example/logo.png");
  });

  it("revision key changes when uploaded logo metadata changes", () => {
    const base = buildTenantBrandingRevisionKey(sampleRow);
    const withoutUpload = buildTenantBrandingRevisionKey({
      ...sampleRow,
      metadata: {},
      updated_at: sampleRow.updated_at,
    });
    assert.notEqual(base, withoutUpload);
    assert.match(base, /tenant-branding\/t1\/logo\/x.png/);
  });

  it("detects uploaded logo from metadata", () => {
    assert.equal(tenantBrandingHasUploadedLogo(sampleRow), true);
    assert.equal(tenantBrandingHasUploadedLogo({ ...sampleRow, metadata: {} }), false);
  });

  it("merge clears brand name when incoming is blank", () => {
    const merged = mergeTenantSettingsSavePayload(sampleRow, {
      brand_name: null,
      logo_url: null,
      primary_colour: "#abcdef",
      secondary_colour: null,
      accent_colour: null,
      support_email: null,
      default_timezone: null,
    });
    assert.equal(merged.brand_name, null);
    assert.equal(merged.logo_url, "https://legacy.example/logo.png");
    assert.equal(merged.primary_colour, "#abcdef");
    assert.equal(merged.secondary_colour, "#222222");
    assert.equal(merged.accent_colour, "#333333");
    assert.equal(merged.support_email, "help@example.com");
    assert.equal(merged.default_timezone, "Europe/London");
  });

  it("preview draft uses resolved tenant logo and persisted colours", () => {
    const branding = {
      ...emptyNormalizedTenantBranding(),
      clinicDisplayName: "Evolved Clinics",
      logoUrl: "https://signed.example/upload.png",
      primaryColor: "#111111",
      accentColor: "#333333",
    };
    const draft = buildTenantBrandingPreviewDraft(
      buildTenantBrandingFormInitialState(sampleRow),
      branding
    );
    assert.equal(draft.logoUrl, "https://signed.example/upload.png");
    assert.equal(draft.primaryColour, "#111111");
    assert.equal(draft.accentColour, "#333333");
  });

  it("enables Remove uploaded logo only when uploaded logo metadata exists", () => {
    const withUpload = computeTenantBrandingLogoControlsState({
      settings: sampleRow,
      canEdit: true,
    });
    assert.equal(withUpload.hasUploadedLogo, true);
    assert.equal(withUpload.removeUploadedEnabled, true);

    const noUpload = computeTenantBrandingLogoControlsState({
      settings: { ...sampleRow, metadata: {} },
      canEdit: true,
    });
    assert.equal(noUpload.hasUploadedLogo, false);
    assert.equal(noUpload.removeUploadedEnabled, false);
  });

  it("does not enable logo controls without edit permission or while busy", () => {
    const readOnly = computeTenantBrandingLogoControlsState({
      settings: sampleRow,
      canEdit: false,
    });
    assert.equal(readOnly.removeUploadedEnabled, false);
    assert.equal(readOnly.clearLegacyEnabled, false);

    const busy = computeTenantBrandingLogoControlsState({
      settings: sampleRow,
      canEdit: true,
      busy: true,
    });
    assert.equal(busy.removeUploadedEnabled, false);
    assert.equal(busy.clearLegacyEnabled, false);
  });

  it("enables Clear legacy logo URL only when a legacy URL exists", () => {
    const withLegacy = computeTenantBrandingLogoControlsState({
      settings: sampleRow,
      canEdit: true,
    });
    assert.equal(withLegacy.hasLegacyLogoUrl, true);
    assert.equal(withLegacy.clearLegacyEnabled, true);

    const noLegacy = computeTenantBrandingLogoControlsState({
      settings: { ...sampleRow, logo_url: null },
      canEdit: true,
    });
    assert.equal(noLegacy.hasLegacyLogoUrl, false);
    assert.equal(noLegacy.clearLegacyEnabled, false);
  });

  it("reports legacy-only status when a legacy URL is present without an upload", () => {
    const legacyOnly = computeTenantBrandingLogoControlsState({
      settings: { ...sampleRow, metadata: {} },
      canEdit: true,
    });
    assert.equal(legacyOnly.legacyOnly, true);
    assert.equal(legacyOnly.statusLabel, "Using legacy logo URL.");

    const uploaded = computeTenantBrandingLogoControlsState({
      settings: sampleRow,
      canEdit: true,
    });
    assert.equal(uploaded.legacyOnly, false);
    assert.equal(uploaded.statusLabel, "Using uploaded logo.");

    const none = computeTenantBrandingLogoControlsState({
      settings: { ...sampleRow, metadata: {}, logo_url: null },
      canEdit: true,
    });
    assert.equal(none.statusLabel, "No logo set — initials will show.");
    assert.equal(tenantBrandingHasLegacyLogoUrl({ ...sampleRow, logo_url: null }), false);
    assert.equal(tenantBrandingHasLegacyLogoUrl(sampleRow), true);
  });

  it("exposes the documented fallback order", () => {
    assert.deepEqual(
      [...TENANT_BRANDING_LOGO_FALLBACK_ORDER],
      ["Uploaded logo", "Legacy logo URL", "Clinic initials", "FI mark"]
    );
  });

  it("preview draft prefers in-progress colour edits", () => {
    const branding = {
      ...emptyNormalizedTenantBranding(),
      clinicDisplayName: "Evolved Clinics",
      primaryColor: "#111111",
      accentColor: "#333333",
    };
    const draft = buildTenantBrandingPreviewDraft(
      {
        ...buildTenantBrandingFormInitialState(sampleRow),
        primary_colour: "#ff00ff",
        accent_colour: "",
      },
      branding
    );
    assert.equal(draft.primaryColour, "#ff00ff");
    assert.equal(draft.accentColour, "#333333");
  });
});
