import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildImagingDeepLinks, listAvailableImagingDeepLinks } from "./imagingDeepLinksCore";

describe("imagingDeepLinksCore", () => {
  it("builds protocol session and gallery links without exposing storage paths", () => {
    const links = buildImagingDeepLinks({
      tenantId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
      protocolSessionId: "33333333-3333-3333-3333-333333333333",
      imageId: "44444444-4444-4444-4444-444444444444",
      reviewRequired: true,
    });
    assert.ok(links.protocolSession?.href.includes("session=33333333"));
    assert.ok(links.patientGallery?.href.includes("image=44444444"));
    assert.ok(links.reviewQueue?.href.includes("/imaging/review"));
    const flat = listAvailableImagingDeepLinks(links);
    assert.ok(flat.every((l) => !l.href.includes("storage_path")));
    assert.ok(flat.every((l) => !l.href.includes("patient-images/")));
  });

  it("falls back gracefully when session unavailable", () => {
    const links = buildImagingDeepLinks({
      tenantId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
      protocolTemplateSlug: "baseline_consultation",
    });
    assert.equal(links.protocolSession?.label, "Protocol capture");
    assert.ok(links.protocolSession?.href.includes("protocol=baseline_consultation"));
  });

  it("omits review queue link when review not required", () => {
    const links = buildImagingDeepLinks({
      tenantId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
      reviewRequired: false,
    });
    assert.equal(links.reviewQueue, null);
  });
});