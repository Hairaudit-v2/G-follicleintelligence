/**
 * FI-PATIENT-APP-2A — public product page copy invariants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PATIENT_APP_PAGE_CONTENT } from "@/lib/marketing/patientAppPageContent";
import {
  PATIENT_APP_PUBLIC_SCREENSHOTS,
  PATIENT_APP_SCREENSHOTS,
} from "@/lib/marketing/patientAppScreenshots";
import { getSitemapPaths } from "@/lib/seo/sitemap-pages";

describe("FI-PATIENT-APP-2A patient app product page", () => {
  it("uses the canonical route and Operational Pilot status", () => {
    assert.equal(PATIENT_APP_PAGE_CONTENT.seo.path, "/platform/patient-app");
    assert.equal(PATIENT_APP_PAGE_CONTENT.hero.maturityLabel, "Operational Pilot");
    assert.match(
      PATIENT_APP_PAGE_CONTENT.hero.maturityBody,
      /controlled pilot scope/i
    );
    assert.match(
      PATIENT_APP_PAGE_CONTENT.hero.availabilityNote,
      /Public app-store distribution is not yet available/i
    );
  });

  it("keeps PatientOS and FI Patient App distinct", () => {
    assert.equal(PATIENT_APP_PAGE_CONTENT.naming.productName, "FI Patient App");
    assert.equal(PATIENT_APP_PAGE_CONTENT.naming.patientOs, "PatientOS");
    assert.match(
      PATIENT_APP_PAGE_CONTENT.naming.patientOsDefinition,
      /clinic-facing longitudinal patient record/i
    );
    assert.match(
      PATIENT_APP_PAGE_CONTENT.naming.patientAppDefinition,
      /patient-facing mobile experience/i
    );
    const banned = [
      "Patient Portal",
      "Patient JourneyOS",
      "Consumer App",
      "Mobile PatientOS",
      "Clinic App",
      "Hair Restoration App",
    ];
    const blob = JSON.stringify(PATIENT_APP_PAGE_CONTENT);
    for (const name of banned) {
      assert.doesNotMatch(blob, new RegExp(name));
    }
  });

  it("does not imply public store availability or deployment", () => {
    const blob = JSON.stringify(PATIENT_APP_PAGE_CONTENT);
    assert.doesNotMatch(blob, /Download now|Available on the App Store|Available on Google Play|Used by thousands|Fully launched|Ready for every clinic/i);
    assert.doesNotMatch(blob, /"Deployed"/);
  });

  it("publishes 3–6 public-safe screenshots with demonstration identity", () => {
    assert.ok(PATIENT_APP_PUBLIC_SCREENSHOTS.length >= 3);
    assert.ok(PATIENT_APP_PUBLIC_SCREENSHOTS.length <= 6);
    for (const id of PATIENT_APP_PUBLIC_SCREENSHOTS) {
      const asset = PATIENT_APP_SCREENSHOTS[id];
      assert.ok(asset.src.startsWith("/os-images/patient-app/"));
      assert.ok(asset.alt.includes("FI Patient App"));
    }
  });

  it("includes FAQ covering access, PatientOS distinction and medical disclaimer", () => {
    const questions = PATIENT_APP_PAGE_CONTENT.faq.items.map((item) => item.q);
    assert.ok(questions.some((q) => /download/i.test(q)));
    assert.ok(questions.some((q) => /PatientOS/i.test(q)));
    assert.ok(questions.some((q) => /medical advice/i.test(q)));
    const medical = PATIENT_APP_PAGE_CONTENT.faq.items.find((item) =>
      /medical advice/i.test(item.q)
    );
    assert.match(medical?.a ?? "", /does not provide medical advice/i);
  });

  it("features remote progress photo capture without claiming full deployment", () => {
    assert.match(PATIENT_APP_PAGE_CONTENT.remoteProgressUpdates.headline, /progress photos/i);
    assert.match(PATIENT_APP_PAGE_CONTENT.remoteProgressUpdates.body, /treatment guarantee/i);
    assert.ok(
      PATIENT_APP_PAGE_CONTENT.remoteProgressUpdates.points.some((p) =>
        /Authorised clinical access/i.test(p.title)
      )
    );
    const photoFaq = PATIENT_APP_PAGE_CONTENT.faq.items.find((item) =>
      /progress photos|follow-up/i.test(item.q)
    );
    assert.ok(photoFaq);
    assert.match(photoFaq?.a ?? "", /progress photos/i);
    assert.match(photoFaq?.a ?? "", /clinical record/i);
    assert.doesNotMatch(photoFaq?.a ?? "", /Fully launched|Available on the App Store/i);
  });

  it("is included in the public sitemap", () => {
    assert.ok(getSitemapPaths().includes("/platform/patient-app"));
  });
});
