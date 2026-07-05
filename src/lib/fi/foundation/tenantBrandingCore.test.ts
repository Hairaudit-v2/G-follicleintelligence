import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildNormalizedBrandingCssVariables,
  safeBrandingColourHex,
  FI_ADMIN_NEUTRAL_PRIMARY,
} from "./brandingCss";
import {
  deriveClinicInitials,
  emptyNormalizedTenantBranding,
  normalizeTenantBranding,
  parseTenantBrandingMetadata,
} from "./tenantBrandingCore";

describe("tenantBrandingCore", () => {
  it("returns FI defaults when branding is missing", () => {
    const b = emptyNormalizedTenantBranding();
    assert.equal(b.clinicDisplayName, "Follicle Intelligence");
    assert.equal(b.logoUrl, null);
    assert.equal(b.clinicInitials, "FI");
    assert.equal(b.primaryColor, FI_ADMIN_NEUTRAL_PRIMARY);
  });

  it("uploaded logo URL wins over legacy logo_url", () => {
    const b = normalizeTenantBranding({
      effective: {
        brand_name: "Evolved",
        logo_url: "https://legacy.example/logo.png",
        primary_colour: "#111111",
        secondary_colour: null,
        accent_colour: "#222222",
        support_email: null,
        default_timezone: null,
        website_url: null,
        clinic_display_name: null,
        booking_url: null,
        public_intake_url: null,
        clinic_phone: null,
        clinic_email: null,
        address: null,
        clinic_timezone: null,
      },
      uploadedLogoUrl: "https://signed.example/upload.png",
    });
    assert.equal(b.logoUrl, "https://signed.example/upload.png");
    assert.equal(b.logoUrlLegacy, "https://legacy.example/logo.png");
  });

  it("missing logo does not throw and yields null logoUrl", () => {
    assert.doesNotThrow(() => {
      const b = normalizeTenantBranding({
        effective: {
          brand_name: null,
          logo_url: null,
          primary_colour: null,
          secondary_colour: null,
          accent_colour: null,
          support_email: null,
          default_timezone: null,
          website_url: null,
          clinic_display_name: null,
          booking_url: null,
          public_intake_url: null,
          clinic_phone: null,
          clinic_email: null,
          address: null,
          clinic_timezone: null,
        },
      });
      assert.equal(b.logoUrl, null);
    });
  });

  it("derives clinic initials from display name", () => {
    assert.equal(deriveClinicInitials("Evolved Hair Clinics"), "EH");
    assert.equal(deriveClinicInitials("Solo"), "SO");
    assert.equal(deriveClinicInitials(""), "FI");
  });

  it("parses logo storage metadata including logo_uploaded_at", () => {
    const meta = parseTenantBrandingMetadata({
      logo_storage_bucket: "tenant-branding",
      logo_storage_path: "tenant-branding/t1/logo/x.png",
      logo_uploaded_at: "2026-07-05T04:00:00.000Z",
      theme_mode: "dark",
    });
    assert.equal(meta.logo_storage_bucket, "tenant-branding");
    assert.equal(meta.logo_storage_path, "tenant-branding/t1/logo/x.png");
    assert.equal(meta.logo_uploaded_at, "2026-07-05T04:00:00.000Z");
    assert.equal(meta.theme_mode, "dark");
  });
});

describe("legacy logo fallback after uploaded logo removal", () => {
  const effectiveWithLegacy = {
    brand_name: "Evolved",
    logo_url: "https://legacy.example/logo.png",
    primary_colour: "#111111",
    secondary_colour: null,
    accent_colour: "#222222",
    support_email: null,
    default_timezone: null,
    website_url: null,
    clinic_display_name: null,
    booking_url: null,
    public_intake_url: null,
    clinic_phone: null,
    clinic_email: null,
    address: null,
    clinic_timezone: null,
  };

  it("uses uploaded logo while it exists", () => {
    const b = normalizeTenantBranding({
      effective: effectiveWithLegacy,
      uploadedLogoUrl: "https://signed.example/upload.png",
    });
    assert.equal(b.logoUrl, "https://signed.example/upload.png");
  });

  it("falls back to the legacy logo_url once the uploaded logo is removed", () => {
    // After removal there is no resolved uploaded URL — legacy remains active.
    const afterRemoval = normalizeTenantBranding({
      effective: effectiveWithLegacy,
      uploadedLogoUrl: null,
    });
    assert.equal(afterRemoval.logoUrl, "https://legacy.example/logo.png");
    assert.equal(afterRemoval.logoUrlLegacy, "https://legacy.example/logo.png");
  });
});

describe("brandingCss shell variables", () => {
  it("exposes tenant CSS variables for the shell", () => {
    const vars = buildNormalizedBrandingCssVariables(
      normalizeTenantBranding({
        effective: {
          brand_name: "Clinic",
          logo_url: null,
          primary_colour: "#aabbcc",
          secondary_colour: null,
          accent_colour: "#112233",
          support_email: null,
          default_timezone: null,
          website_url: null,
          clinic_display_name: "Clinic",
          booking_url: null,
          public_intake_url: null,
          clinic_phone: null,
          clinic_email: null,
          address: null,
          clinic_timezone: null,
        },
      })
    ) as Record<string, string>;
    assert.equal(vars["--fi-tenant-primary"], safeBrandingColourHex("#aabbcc", FI_ADMIN_NEUTRAL_PRIMARY));
    assert.equal(vars["--fi-tenant-accent"], "#112233");
    assert.ok(String(vars["--fi-tenant-primary-soft"]).startsWith("rgba("));
    assert.ok(String(vars["--fi-tenant-brand-bg"]).startsWith("rgba("));
  });

  it("primary/accent changes visibly change the variables the shell + preview consume", () => {
    const build = (primary: string, accent: string) =>
      buildNormalizedBrandingCssVariables(
        normalizeTenantBranding({
          effective: {
            brand_name: "Clinic",
            logo_url: null,
            primary_colour: primary,
            secondary_colour: null,
            accent_colour: accent,
            support_email: null,
            default_timezone: null,
            website_url: null,
            clinic_display_name: "Clinic",
            booking_url: null,
            public_intake_url: null,
            clinic_phone: null,
            clinic_email: null,
            address: null,
            clinic_timezone: null,
          },
        })
      ) as Record<string, string>;

    const teal = build("#0d9488", "#22d3ee");
    const magenta = build("#be185d", "#f472b6");

    // Selected nav/tabs/buttons read these vars — different brands must differ.
    assert.notEqual(teal["--fi-tenant-primary"], magenta["--fi-tenant-primary"]);
    assert.notEqual(teal["--fi-tenant-accent"], magenta["--fi-tenant-accent"]);
    assert.notEqual(teal["--fi-tenant-primary-soft"], magenta["--fi-tenant-primary-soft"]);
    assert.notEqual(teal["--fi-tenant-brand-bg"], magenta["--fi-tenant-brand-bg"]);

    // Soft + brand-bg are derived from primary at different alphas.
    assert.notEqual(teal["--fi-tenant-primary-soft"], teal["--fi-tenant-brand-bg"]);
    assert.ok(teal["--fi-tenant-primary-soft"]!.includes("0.16"));
    assert.ok(teal["--fi-tenant-brand-bg"]!.includes("0.08"));
  });
});
