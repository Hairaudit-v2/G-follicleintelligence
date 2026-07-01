import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveProtocolCatalog } from "./protocolCatalogResolverCore";
import { buildProtocolCatalogCaptureMetadata } from "./protocolCaptureMetadataCore";

describe("protocolCaptureMetadataCore", () => {
  it("writes protocol source and version into capture metadata", () => {
    const protocol = resolveProtocolCatalog({
      templateSlug: "baseline_consultation",
      resolvedAt: "2026-07-01T00:00:00.000Z",
    });
    const meta = buildProtocolCatalogCaptureMetadata(protocol);
    assert.equal(meta.protocol_template_slug, "baseline_consultation");
    assert.equal(meta.protocol_catalog_source, "imagingos_canonical");
    assert.ok(typeof meta.protocol_catalog_version === "string");
  });

  it("tenant override source appears in metadata", () => {
    const protocol = resolveProtocolCatalog({
      templateSlug: "hair_loss_consultation",
      tenantDbTemplate: {
        slug: "hair_loss_consultation",
        name: "Tenant override",
        slots: [{ slug: "tenant_front", label: "Tenant front", required: true }],
      },
      resolvedAt: "2026-07-01T00:00:00.000Z",
    });
    const meta = buildProtocolCatalogCaptureMetadata(protocol);
    assert.equal(meta.protocol_catalog_source, "tenant_db");
    assert.equal(meta.protocol_template_slug, "hair_loss_consultation");
  });
});