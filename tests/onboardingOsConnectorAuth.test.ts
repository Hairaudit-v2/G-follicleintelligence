import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  applyConnectorAuthAdoptionBonus,
  applyConnectorAuthInfrastructureBonus,
} from "../src/lib/onboarding-os/deploymentIntelligenceCore";
import {
  buildConnectorAuthHealthSummary,
  buildConnectorVerificationResult,
  buildRequiredPermissionScopes,
  buildTokenExpiryWarning,
  calculatePermissionCoverage,
  resolveSupportedAuthMethods,
  validateConnectorAuthInput,
} from "../src/lib/onboarding-os/externalConnectorAuthCore";
import {
  EXTERNAL_CONNECTOR_AUTH_METHODS,
  EXTERNAL_CONNECTOR_AUTH_STATUSES,
} from "../src/lib/onboarding-os/externalConnectorAuthTypes";
import { EXTERNAL_CONNECTOR_PROVIDERS } from "../src/lib/onboarding-os/externalConnectorTypes";

describe("OnboardingOS Phase F2 — supported auth methods", () => {
  it("resolveSupportedAuthMethods returns provider-specific methods", () => {
    assert.deepEqual(resolveSupportedAuthMethods("hubspot"), ["oauth2", "api_key", "manual_placeholder"]);
    assert.deepEqual(resolveSupportedAuthMethods("google_calendar"), ["oauth2", "manual_placeholder"]);
    assert.deepEqual(resolveSupportedAuthMethods("stripe"), ["api_key", "webhook_secret", "manual_placeholder"]);
    assert.ok(resolveSupportedAuthMethods("pabau").includes("api_key"));
  });

  it("every provider resolves at least manual_placeholder", () => {
    for (const provider of EXTERNAL_CONNECTOR_PROVIDERS) {
      const methods = resolveSupportedAuthMethods(provider);
      assert.ok(methods.length > 0);
      assert.ok(methods.every((m) => (EXTERNAL_CONNECTOR_AUTH_METHODS as readonly string[]).includes(m)));
    }
  });
});

describe("OnboardingOS Phase F2 — required permission scopes", () => {
  it("buildRequiredPermissionScopes includes provider scope examples", () => {
    const hubspot = buildRequiredPermissionScopes("hubspot").map((s) => s.scopeKey);
    assert.deepEqual(hubspot, ["contacts.read", "deals.read", "tickets.read"]);

    const pabau = buildRequiredPermissionScopes("pabau").map((s) => s.scopeKey);
    assert.deepEqual(pabau, ["patients.read", "appointments.read"]);

    const cliniko = buildRequiredPermissionScopes("cliniko").map((s) => s.scopeKey);
    assert.ok(cliniko.includes("invoices.read"));

    const googleCalendar = buildRequiredPermissionScopes("google_calendar").map((s) => s.scopeKey);
    assert.deepEqual(googleCalendar, ["calendar.readonly"]);

    const stripe = buildRequiredPermissionScopes("stripe").map((s) => s.scopeKey);
    assert.deepEqual(stripe, ["charges.read", "invoices.read", "customers.read"]);

    const xero = buildRequiredPermissionScopes("xero").map((s) => s.scopeKey);
    assert.ok(xero.includes("accounting.transactions.read"));

    const meta = buildRequiredPermissionScopes("meta_ads").map((s) => s.scopeKey);
    assert.deepEqual(meta, ["ads_read"]);

    const googleAds = buildRequiredPermissionScopes("google_ads").map((s) => s.scopeKey);
    assert.deepEqual(googleAds, ["adwords.readonly"]);
  });
});

describe("OnboardingOS Phase F2 — auth input validation", () => {
  it("validateConnectorAuthInput rejects unknown provider and unsupported method", () => {
    const unknown = validateConnectorAuthInput("unknown", { authMethod: "api_key" });
    assert.equal(unknown.ok, false);

    const badMethod = validateConnectorAuthInput("google_calendar", { authMethod: "api_key" });
    assert.equal(badMethod.ok, false);
    if (!badMethod.ok) assert.match(badMethod.errors.join(" "), /not supported/);
  });

  it("validateConnectorAuthInput accepts test mode without live credential material", () => {
    const result = validateConnectorAuthInput("microsoft_outlook", {
      authMethod: "oauth2",
      testMode: true,
    });
    assert.equal(result.ok, true);
  });
});

describe("OnboardingOS Phase F2 — permission coverage and verification", () => {
  it("calculatePermissionCoverage returns percentage of required granted scopes", () => {
    const half = calculatePermissionCoverage([
      { scopeKey: "a", scopeLabel: "A", required: true, granted: true },
      { scopeKey: "b", scopeLabel: "B", required: true, granted: false },
    ]);
    assert.equal(half, 50);

    const full = calculatePermissionCoverage([
      { scopeKey: "a", scopeLabel: "A", required: true, granted: true },
      { scopeKey: "b", scopeLabel: "B", required: true, granted: true },
    ]);
    assert.equal(full, 100);
  });

  it("buildConnectorVerificationResult returns verified with full test scopes", () => {
    const result = buildConnectorVerificationResult({
      provider: "cliniko",
      authMethod: "api_key",
      input: { authMethod: "api_key", testMode: true, apiKey: "test-key" },
      credentialConfigured: true,
    });
    assert.equal(result.authStatus, "verified");
    assert.equal(result.outcome, "success");
    assert.equal(result.permissionCoveragePercent, 100);
    assert.equal(result.testMode, true);
  });

  it("buildConnectorVerificationResult returns insufficient_permissions when scopes missing", () => {
    const result = buildConnectorVerificationResult({
      provider: "hubspot",
      authMethod: "oauth2",
      input: {
        authMethod: "oauth2",
        testMode: true,
        oauthAccessToken: "token",
        grantedScopes: ["contacts.read"],
      },
      credentialConfigured: true,
    });
    assert.equal(result.authStatus, "insufficient_permissions");
    assert.equal(result.outcome, "warning");
    assert.ok(result.permissionCoveragePercent < 100);
    assert.ok(result.blockers.some((b) => /Missing scope/.test(b)));
  });

  it("buildConnectorVerificationResult returns failed for invalid credential shape", () => {
    const result = buildConnectorVerificationResult({
      provider: "stripe",
      authMethod: "api_key",
      input: { authMethod: "api_key", testMode: true },
      credentialConfigured: false,
    });
    assert.equal(result.authStatus, "failed");
    assert.equal(result.outcome, "error");
    assert.ok(result.blockers.some((b) => /credentials/i.test(b)));
  });
});

describe("OnboardingOS Phase F2 — token expiry and health summary", () => {
  it("buildTokenExpiryWarning warns on near and past expiry", () => {
    const past = buildTokenExpiryWarning(new Date(Date.now() - 60_000).toISOString());
    assert.match(past ?? "", /expired/i);

    const soon = buildTokenExpiryWarning(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString());
    assert.match(soon ?? "", /expires in/i);

    const far = buildTokenExpiryWarning(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString());
    assert.equal(far, null);
  });

  it("buildConnectorAuthHealthSummary includes verification notice", () => {
    const summary = buildConnectorAuthHealthSummary({
      authSession: null,
      requiredScopes: buildRequiredPermissionScopes("pabau"),
      grantedScopes: [],
    });
    assert.equal(summary.authStatus, "not_started");
    assert.ok(summary.warnings.some((w) => /Verification required before live sync/i.test(w)));
    assert.equal(summary.readyForLiveSync, false);
  });
});

describe("OnboardingOS Phase F2 — verification event shape", () => {
  it("verification result exposes outcome and provider payload without secrets", () => {
    const result = buildConnectorVerificationResult({
      provider: "xero",
      authMethod: "api_key",
      input: { authMethod: "api_key", testMode: true, apiKey: "secret-should-not-appear-in-payload" },
      credentialConfigured: true,
    });
    const payload = JSON.stringify(result.providerPayload);
    assert.doesNotMatch(payload, /secret-should-not-appear-in-payload/);
    assert.equal(result.providerPayload.stub, true);
    assert.ok(["success", "warning", "error"].includes(result.outcome));
    assert.ok((EXTERNAL_CONNECTOR_AUTH_STATUSES as readonly string[]).includes(result.authStatus));
  });
});

describe("OnboardingOS Phase F2 — deployment intelligence connector bonus", () => {
  it("applyConnectorAuthInfrastructureBonus improves score for registered verified connectors", () => {
    const base = applyConnectorAuthInfrastructureBonus(70, {
      registeredCount: 2,
      verifiedCount: 1,
      unverifiedCount: 1,
      failedCount: 0,
      avgPermissionCoverage: 80,
    });
    assert.ok(base.percent > 70);
    assert.ok(base.warnings.some((w) => /not verified/i.test(w)));
  });

  it("applyConnectorAuthAdoptionBonus improves adoption when connectors verified", () => {
    const boosted = applyConnectorAuthAdoptionBonus(50, {
      registeredCount: 1,
      verifiedCount: 1,
      unverifiedCount: 0,
      failedCount: 0,
      avgPermissionCoverage: 100,
    });
    assert.ok(boosted.percent > 50);
  });
});

describe("OnboardingOS Phase F2 — migration smoke checks", () => {
  it("defines auth verification tables with tenant-safe RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120011_onboarding_os_phase_f2_connector_auth_verification.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.match(sql, /create table if not exists public\.fi_external_connector_auth_sessions/);
    assert.match(sql, /create table if not exists public\.fi_external_connector_token_refresh_events/);
    assert.match(sql, /create table if not exists public\.fi_external_connector_permission_scopes/);
    assert.match(sql, /create table if not exists public\.fi_external_connector_verification_events/);

    assert.match(sql, /fi_external_connector_auth_sessions_select_tenant_member/);
    assert.match(sql, /fi_external_connector_verification_events_select_tenant_member/);
    assert.match(sql, /grant insert on public\.fi_external_connector_verification_events to service_role/);
    assert.match(sql, /grant insert on public\.fi_external_connector_token_refresh_events to service_role/);

    for (const col of ["tenant_id", "integration_id", "provider", "auth_status", "created_at"]) {
      assert.match(sql, new RegExp(col));
    }

    for (const method of ["oauth2", "api_key", "webhook_secret", "manual_placeholder"]) {
      assert.match(sql, new RegExp(method));
    }

    for (const status of ["not_started", "verified", "insufficient_permissions", "revoked"]) {
      assert.match(sql, new RegExp(status));
    }
  });
});

describe("OnboardingOS Phase F2 — guided assist copy", () => {
  it("includes verify existing systems tip and next action", () => {
    const catalogPath = path.join(process.cwd(), "src/lib/onboarding-os/guidedAssistCatalog.ts");
    const src = fs.readFileSync(catalogPath, "utf8");
    assert.match(src, /onboarding_verify_existing_systems/);
    assert.match(src, /next_verify_connector_permissions/);
    assert.match(src, /Verify connector credentials/);
  });
});
