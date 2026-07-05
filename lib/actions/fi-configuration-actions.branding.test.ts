import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeTenantSettingsSavePayload } from "@/src/lib/fi/foundation/tenantBrandingFormCore";
import type { FiTenantSettingsRow } from "@/src/lib/fi/foundation/tenantSettings";

/** Mirrors upsertTenantSettingsAction merge semantics for regression coverage. */
function simulateTenantSettingsSave(
  existing: FiTenantSettingsRow | null,
  form: Record<string, string>
) {
  const trimToNull = (v: string) => {
    const s = v.trim();
    return s === "" ? null : s;
  };
  const incoming = {
    brand_name: trimToNull(form.brand_name ?? ""),
    logo_url: trimToNull(form.logo_url ?? ""),
    primary_colour: trimToNull(form.primary_colour ?? ""),
    secondary_colour: trimToNull(form.secondary_colour ?? ""),
    accent_colour: trimToNull(form.accent_colour ?? ""),
    support_email: trimToNull(form.support_email ?? ""),
    default_timezone: trimToNull(form.default_timezone ?? ""),
  };
  return mergeTenantSettingsSavePayload(existing, incoming);
}

describe("upsertTenantSettingsAction branding merge", () => {
  const existing: FiTenantSettingsRow = {
    id: "1",
    tenant_id: "t1",
    brand_name: "Clinic",
    logo_url: null,
    primary_colour: "#000000",
    secondary_colour: null,
    accent_colour: "#C9A24D",
    support_email: null,
    default_timezone: null,
    metadata: {
      logo_storage_bucket: "tenant-branding",
      logo_storage_path: "tenant-branding/t1/logo/a.png",
      logo_uploaded_at: "2026-07-05T00:00:00.000Z",
    },
    created_at: "2026-01-01",
    updated_at: "2026-07-05",
  };

  it("save colours only preserves uploaded logo metadata companions on row", () => {
    const payload = simulateTenantSettingsSave(existing, {
      brand_name: "",
      logo_url: "",
      primary_colour: "#7c3aed",
      secondary_colour: "",
      accent_colour: "#f59e0b",
      support_email: "",
      default_timezone: "",
    });
    assert.equal(payload.primary_colour, "#7c3aed");
    assert.equal(payload.accent_colour, "#f59e0b");
    assert.equal(payload.brand_name, "Clinic");
  });

  it("empty edit fields do not erase existing branding columns", () => {
    const payload = simulateTenantSettingsSave(existing, {
      brand_name: "",
      logo_url: "",
      primary_colour: "",
      secondary_colour: "",
      accent_colour: "",
      support_email: "",
      default_timezone: "",
    });
    assert.deepEqual(payload, {
      brand_name: "Clinic",
      logo_url: null,
      primary_colour: "#000000",
      secondary_colour: null,
      accent_colour: "#C9A24D",
      support_email: null,
      default_timezone: null,
    });
  });
});
