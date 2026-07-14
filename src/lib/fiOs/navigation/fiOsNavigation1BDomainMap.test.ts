import assert from "node:assert/strict";
import test from "node:test";

import {
  labelHasLegacyModuleLanguage,
  labelHasOsSuffix,
  mapNavIdTo1BDomain,
  mapNavLabelTo1BDomain,
  mapRouteSuffixTo1BDomain,
  resolve1BDomainForNavItem,
} from "@/src/lib/fiOs/navigation/fiOsNavigation1BDomainMap";

test("Reception board maps to Front Desk", () => {
  assert.equal(mapNavIdTo1BDomain("reception-board"), "Front Desk");
  assert.equal(mapNavLabelTo1BDomain("Reception board"), "Front Desk");
});

test("Tomorrow board maps to Front Desk", () => {
  assert.equal(mapNavIdTo1BDomain("tomorrow-board"), "Front Desk");
  assert.equal(mapNavLabelTo1BDomain("Tomorrow board"), "Front Desk");
});

test("Onboarding maps to Team", () => {
  assert.equal(mapNavIdTo1BDomain("onboarding-centre"), "Team");
  assert.equal(mapNavLabelTo1BDomain("Onboarding"), "Team");
  assert.equal(mapNavLabelTo1BDomain("Onboarding Centre"), "Team");
});

test("Staff maps to Team", () => {
  assert.equal(mapNavIdTo1BDomain("staff"), "Team");
  assert.equal(mapNavLabelTo1BDomain("Staff"), "Team");
});

test("Workforce/HR labels map to Team", () => {
  assert.equal(mapNavIdTo1BDomain("hr-os"), "Team");
  assert.equal(mapNavLabelTo1BDomain("Team"), "Team");
  assert.equal(mapRouteSuffixTo1BDomain("workforce-os"), "Team");
  assert.equal(mapRouteSuffixTo1BDomain("hr-os/onboarding"), "Team");
});

test("Payments and Finances map to Finance", () => {
  assert.equal(mapNavIdTo1BDomain("payments-inbox"), "Finance");
  assert.equal(mapNavIdTo1BDomain("financial-os"), "Finance");
  assert.equal(mapNavLabelTo1BDomain("Payments"), "Finance");
  assert.equal(mapNavLabelTo1BDomain("Finances"), "Finance");
});

test("Insights and Quality review map to Reports", () => {
  assert.equal(mapNavIdTo1BDomain("analytics"), "Reports");
  assert.equal(mapNavIdTo1BDomain("auditos"), "Reports");
  assert.equal(mapNavLabelTo1BDomain("Insights"), "Reports");
  assert.equal(mapNavLabelTo1BDomain("Quality review"), "Reports");
});

test("Doctor overview and Pathology map to Clinical", () => {
  assert.equal(mapNavIdTo1BDomain("doctor-workspace"), "Clinical");
  assert.equal(mapNavIdTo1BDomain("pathology-nav"), "Clinical");
  assert.equal(mapNavLabelTo1BDomain("Doctor overview"), "Clinical");
  assert.equal(mapNavLabelTo1BDomain("Doctor workspace"), "Clinical");
  assert.equal(mapNavLabelTo1BDomain("Pathology"), "Clinical");
});

test("Cases and Ready for surgery map to Surgery", () => {
  assert.equal(mapNavIdTo1BDomain("cases"), "Surgery");
  assert.equal(mapNavIdTo1BDomain("surgery-readiness-board"), "Surgery");
  assert.equal(mapNavLabelTo1BDomain("Cases"), "Surgery");
  assert.equal(mapNavLabelTo1BDomain("Ready for surgery"), "Surgery");
  assert.equal(mapNavLabelTo1BDomain("Surgery day"), "Surgery");
  assert.equal(mapRouteSuffixTo1BDomain("surgery-os/intelligence"), "Surgery");
});

test("OS suffixes are not aligned in staff-facing labels", () => {
  assert.equal(labelHasOsSuffix("Surgery OS"), true);
  assert.equal(labelHasLegacyModuleLanguage("Onboarding Centre"), true);
  assert.equal(labelHasLegacyModuleLanguage("Health record"), false);
  assert.equal(labelHasLegacyModuleLanguage("Front desk"), false);
  assert.equal(labelHasLegacyModuleLanguage("Surgery day"), false);
  assert.equal(labelHasLegacyModuleLanguage("Ready for surgery"), false);
  assert.equal(labelHasLegacyModuleLanguage("SurgeryOS"), true);
  assert.equal(labelHasLegacyModuleLanguage("Command Centre"), true);
});

test("resolve1BDomainForNavItem prefers id then route suffix then label", () => {
  assert.equal(
    resolve1BDomainForNavItem({ id: "calendar", label: "Ignored", routeSuffix: null }),
    "Calendar"
  );
  assert.equal(
    resolve1BDomainForNavItem({
      id: "unknown-id",
      label: "Presence engine",
      routeSuffix: "intelligence/presence",
    }),
    "Reports"
  );
});
