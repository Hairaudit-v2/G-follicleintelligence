import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type Decision = "KEEP" | "MERGE" | "REDIRECT" | "LINK" | "RETIRE" | "HOLD";

type Evidence = {
  milestone: string;
  verdict: string;
  capabilitiesAudited: number;
  routeDecisionCounts: Record<Decision, number>;
  canonicalNavigation: {
    universalRail: string[];
    roleFilteredMore: string[];
    academyActive: boolean;
    pipelineUniversalRail: boolean;
    pipelineCanonicalRoute: string;
  };
  canonicalOwners: Array<{
    id: string;
    capability: string;
    owner: string;
    canonicalRoute: string;
    status: string;
  }>;
  routeDecisions: Array<Record<string, unknown> & { decision: Decision }>;
};

const evidencePath = path.join(process.cwd(), "docs", "audits", "evidence-fi-ux-structure-2b.json");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as Evidence;

const requiredRouteDecisionFields = [
  "capability",
  "currentRouteLocation",
  "currentJob",
  "primaryUsers",
  "canonicalOwner",
  "canonicalRoute",
  "decision",
  "reason",
  "permissionRisk",
  "deepLinkRisk",
  "queryContextPreservation",
  "part2cAction",
  "rollbackPath",
] as const;

function owner(id: string) {
  const entry = evidence.canonicalOwners.find((candidate) => candidate.id === id);
  assert.ok(entry, `missing canonical owner for ${id}`);
  return entry;
}

function appPageForRoute(route: string): string | null {
  const withoutQuery = route.split("?")[0]!;
  if (!withoutQuery.startsWith("/fi-admin/")) return null;
  const relative = withoutQuery.slice("/fi-admin/".length);
  return path.join(process.cwd(), "app", "(fi-admin)", "fi-admin", relative, "page.tsx");
}

test("ownership evidence declares exactly one owner for every audited capability", () => {
  assert.equal(evidence.milestone, "FI-UX-STRUCTURE-2B");
  assert.equal(evidence.capabilitiesAudited, evidence.canonicalOwners.length);
  assert.equal(evidence.capabilitiesAudited, 46);

  const ids = evidence.canonicalOwners.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "capability ids must be unique");
  for (const entry of evidence.canonicalOwners) {
    assert.ok(entry.owner.trim(), `${entry.id} has no owner`);
    assert.ok(entry.canonicalRoute.trim(), `${entry.id} has no canonical route`);
    assert.ok(entry.status.trim(), `${entry.id} has no status`);
  }
});

test("frozen Team, Settings, Integrations and Deployment boundaries are consistent", () => {
  assert.equal(owner("staff-directory").owner, "Team");
  assert.equal(owner("person-access-readiness").owner, "Team");
  assert.equal(owner("person-role-assignment").owner, "Team");
  assert.equal(owner("staff-entitlement-policy").owner, "Settings");
  assert.equal(owner("nonstaff-admin-identities").owner, "Settings");
  assert.equal(owner("hubspot-connection").owner, "Integrations");
  assert.equal(owner("provider-health").owner, "Integrations");
  assert.equal(owner("deployment-readiness").owner, "Deployment");
  assert.equal(owner("deployment-migration-go-live").owner, "Deployment");
});

test("the universal rail stays bounded and Academy is not approved as active", () => {
  assert.deepEqual(evidence.canonicalNavigation.universalRail, [
    "Today",
    "Calendar",
    "Patients",
    "Front Desk",
    "Team",
    "More",
  ]);
  assert.equal(evidence.canonicalNavigation.pipelineUniversalRail, false);
  assert.equal(evidence.canonicalNavigation.pipelineCanonicalRoute, "/fi-admin/[tenantId]/crm");
  assert.equal(evidence.canonicalNavigation.academyActive, false);
  assert.ok(!evidence.canonicalNavigation.roleFilteredMore.includes("Academy"));
});

test("every route decision is classified and contains the implementation handoff schema", () => {
  const allowed = new Set<Decision>(["KEEP", "MERGE", "REDIRECT", "LINK", "RETIRE", "HOLD"]);
  const counts: Record<Decision, number> = {
    KEEP: 0,
    MERGE: 0,
    REDIRECT: 0,
    LINK: 0,
    RETIRE: 0,
    HOLD: 0,
  };

  for (const [index, decision] of evidence.routeDecisions.entries()) {
    assert.ok(allowed.has(decision.decision), `route decision ${index} is unclassified`);
    counts[decision.decision] += 1;
    for (const field of requiredRouteDecisionFields) {
      const value = decision[field];
      assert.ok(value !== undefined && value !== null, `route decision ${index} lacks ${field}`);
      if (typeof value === "string") {
        assert.ok(value.trim(), `route decision ${index} has empty ${field}`);
      }
    }
  }

  assert.deepEqual(counts, evidence.routeDecisionCounts);
});

test("all declared canonical application routes currently resolve to page files", () => {
  for (const entry of evidence.canonicalOwners) {
    const page = appPageForRoute(entry.canonicalRoute);
    assert.ok(page, `${entry.id} does not use an application route`);
    assert.ok(existsSync(page!), `${entry.id} canonical route has no page: ${page}`);
  }
});

test("person access and entitlement policy do not share a canonical route", () => {
  assert.notEqual(
    owner("person-access-readiness").canonicalRoute,
    owner("staff-entitlement-policy").canonicalRoute
  );
  assert.match(owner("person-access-readiness").canonicalRoute, /\/team\/identity$/);
  assert.match(owner("staff-entitlement-policy").canonicalRoute, /\/settings\/staff-access$/);
});
