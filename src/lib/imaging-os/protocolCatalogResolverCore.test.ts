import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HLI_TO_CANONICAL_PROTOCOL_SLUG,
  resolveFromHliMapping,
  resolveFromImagingOsCanonical,
  resolveFromTenantDb,
  resolveFromVieLegacy,
  resolveProtocolCatalog,
} from "./protocolCatalogResolverCore";

describe("protocolCatalogResolverCore", () => {
  const at = "2026-07-01T00:00:00.000Z";

  it("tenant DB template wins over canonical", () => {
    const resolved = resolveProtocolCatalog({
      templateSlug: "baseline_consultation",
      tenantDbTemplate: {
        slug: "baseline_consultation",
        name: "Tenant baseline",
        slots: [{ slug: "custom_front", label: "Custom front", required: true }],
      },
      resolvedAt: at,
    });
    assert.equal(resolved.metadata.source, "tenant_db");
    assert.equal(resolved.slots[0]?.slug, "custom_front");
  });

  it("falls back to ImagingOS canonical when no tenant template", () => {
    const resolved = resolveProtocolCatalog({
      templateSlug: "baseline_consultation",
      resolvedAt: at,
    });
    assert.equal(resolved.metadata.source, "imagingos_canonical");
    assert.ok(resolved.slots.length >= 6);
  });

  it("HLI mapping fallback uses mapped canonical slots", () => {
    const fromHli = resolveFromHliMapping(
      {
        slug: "consultation_standard",
        name: "HLI consultation",
        slots: [
          {
            slot_slug: "front",
            label: "Front",
            is_required: true,
            capture_guidance: "Face camera",
            required_image_category: "front",
          },
        ],
      },
      at
    );
    assert.ok(fromHli);
    assert.equal(fromHli.metadata.source, "hli_mapping");
    assert.equal(fromHli.metadata.mapped_from, HLI_TO_CANONICAL_PROTOCOL_SLUG.consultation_standard);
  });

  it("VIE legacy returns empty slots for unknown slug", () => {
    const legacy = resolveFromVieLegacy("unknown_protocol_xyz", at);
    assert.equal(legacy.metadata.source, "vie_legacy");
    assert.equal(legacy.slots.length, 0);
  });

  it("canonical resolver returns slots for surgery_day", () => {
    const canonical = resolveFromImagingOsCanonical("surgery_day", at);
    assert.ok(canonical);
    assert.equal(canonical.metadata.source, "imagingos_canonical");
    assert.ok(canonical.slots.length > 0);
  });

  it("tenant DB returns null when slots empty", () => {
    const fromDb = resolveFromTenantDb(
      { slug: "x", name: "X", slots: [] },
      at
    );
    assert.equal(fromDb, null);
  });
});