import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildConnectorMappingPlan,
  buildSupportedConnectorCatalog,
  calculateConnectorSyncHealth,
  defaultConnectorDisplayName,
  getConnectorCatalogEntry,
  groupConnectorCatalogByCategory,
  resolveConnectorHealthStatus,
  resolveInitialConnectorStatus,
  validateConnectorConfiguration,
} from "../src/lib/onboarding-os/externalConnectorCore";
import {
  encryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  decryptExternalConnectorSecret,
  serializeConnectorCredentialPayload,
} from "../src/lib/onboarding-os/externalConnectorSecretCrypto.server";
import {
  EXTERNAL_CONNECTOR_CATEGORIES,
  EXTERNAL_CONNECTOR_PROVIDERS,
} from "../src/lib/onboarding-os/externalConnectorTypes";

describe("OnboardingOS Phase F1 — connector catalog", () => {
  it("buildSupportedConnectorCatalog includes all providers across four categories", () => {
    const catalog = buildSupportedConnectorCatalog();
    assert.equal(catalog.length, EXTERNAL_CONNECTOR_PROVIDERS.length);

    const categories = new Set(catalog.map((e) => e.category));
    for (const cat of EXTERNAL_CONNECTOR_CATEGORIES) {
      assert.ok(categories.has(cat), `Missing category: ${cat}`);
    }

    for (const entry of catalog) {
      assert.equal(entry.liveSyncAvailable, false);
      assert.ok(entry.configFields.length > 0);
      assert.deepEqual(entry.supportedSyncModes, ["manual", "disabled"]);
    }
  });

  it("getConnectorCatalogEntry resolves provider metadata", () => {
    const cliniko = getConnectorCatalogEntry("cliniko");
    assert.ok(cliniko);
    assert.equal(cliniko.category, "crm");
    assert.equal(cliniko.label, "Cliniko");
  });

  it("groupConnectorCatalogByCategory groups by display label", () => {
    const grouped = groupConnectorCatalogByCategory(buildSupportedConnectorCatalog());
    assert.ok(grouped.CRM?.some((e) => e.provider === "hubspot"));
    assert.ok(grouped.Calendar?.some((e) => e.provider === "google_calendar"));
    assert.ok(grouped.Finance?.some((e) => e.provider === "stripe"));
    assert.ok(grouped.Marketing?.some((e) => e.provider === "meta_ads"));
  });
});

describe("OnboardingOS Phase F1 — configuration validation", () => {
  it("validateConnectorConfiguration rejects unknown provider", () => {
    const result = validateConnectorConfiguration({ provider: "unknown" as "pabau" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.join(" "), /Unknown connector provider/);
  });

  it("validateConnectorConfiguration requires config fields and credentials for Cliniko", () => {
    const empty = validateConnectorConfiguration({ provider: "cliniko", config: {} });
    assert.equal(empty.ok, false);

    const valid = validateConnectorConfiguration({
      provider: "cliniko",
      config: { shard: "au1" },
      credentialPlaintext: "test-api-key",
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.provider, "cliniko");
      assert.equal(valid.category, "crm");
    }
  });

  it("validateConnectorConfiguration rejects unsupported sync modes", () => {
    const result = validateConnectorConfiguration({
      provider: "stripe",
      config: { api_key: "sk_test" },
      credentialPlaintext: "sk_test",
      syncMode: "webhook",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.join(" "), /Sync mode/);
  });

  it("defaultConnectorDisplayName and resolveInitialConnectorStatus follow setup state", () => {
    assert.equal(defaultConnectorDisplayName("xero"), "Xero connector");
    assert.equal(resolveInitialConnectorStatus(true, true), "configured");
    assert.equal(resolveInitialConnectorStatus(false, true), "draft");
  });
});

describe("OnboardingOS Phase F1 — mapping and health", () => {
  it("buildConnectorMappingPlan returns entity mappings per provider", () => {
    const hubspot = buildConnectorMappingPlan("hubspot");
    assert.equal(hubspot.category, "crm");
    assert.ok(hubspot.entries.some((e) => e.sourceEntity === "contact"));

    const stripe = buildConnectorMappingPlan("stripe");
    assert.equal(stripe.category, "finance");
    assert.ok(stripe.entries.some((e) => e.targetEntity === "fi_invoice"));
  });

  it("calculateConnectorSyncHealth degrades when credentials or sync missing", () => {
    const low = calculateConnectorSyncHealth({
      integrationStatus: "draft",
      syncStatus: null,
      healthScore: 80,
      lastSuccessAt: null,
      lastError: null,
      recentFailureCount: 0,
      credentialConfigured: false,
    });
    assert.ok(low.score <= 30);
    assert.equal(low.band, "unhealthy");
    assert.ok(low.recommendations.some((r) => /credentials/i.test(r)));

    const healthy = calculateConnectorSyncHealth({
      integrationStatus: "configured",
      syncStatus: "success",
      healthScore: 90,
      lastSuccessAt: "2026-06-22T12:00:00.000Z",
      lastError: null,
      recentFailureCount: 0,
      credentialConfigured: true,
    });
    assert.equal(healthy.band, "healthy");
  });

  it("resolveConnectorHealthStatus wraps sync health for an integration", () => {
    const health = resolveConnectorHealthStatus({
      integrationId: "00000000-0000-4000-8000-000000000099",
      provider: "google_calendar",
      status: "configured",
      syncStatus: "idle",
      healthScore: 65,
      lastSyncAt: null,
      lastSuccessAt: "2026-06-22T12:00:00.000Z",
      lastError: null,
      credentialConfigured: true,
    });
    assert.equal(health.provider, "google_calendar");
    assert.equal(health.healthBand, "degraded");
    assert.ok(health.blockers.length >= 0);
  });
});

describe("OnboardingOS Phase F1 — credential encryption", () => {
  it("encrypts and decrypts connector credential payloads", () => {
    const key = deriveExternalConnectorMasterKey("test-master-key-phase-f1");
    assert.ok(key);

    const serialized = serializeConnectorCredentialPayload({
      credentialKind: "api_key",
      plaintext: "secret-value",
      config: { shard: "au1" },
    });

    const encrypted = encryptExternalConnectorSecret(serialized, key!);
    const decrypted = decryptExternalConnectorSecret(encrypted, key!);
    assert.equal(decrypted, serialized);

    const parsed = JSON.parse(decrypted) as { secret: string; kind: string };
    assert.equal(parsed.secret, "secret-value");
    assert.equal(parsed.kind, "api_key");
  });
});

describe("OnboardingOS Phase F1 — migration", () => {
  it("defines connector layer tables with tenant-safe RLS and indexes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20260922120010_onboarding_os_phase_f_connector_layer.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.match(sql, /create table if not exists public\.fi_tenant_external_integrations/);
    assert.match(sql, /create table if not exists public\.fi_external_connector_credentials/);
    assert.match(sql, /create table if not exists public\.fi_external_sync_status/);
    assert.match(sql, /create table if not exists public\.fi_external_sync_events/);
    assert.match(sql, /create table if not exists public\.fi_external_data_mappings/);

    assert.match(sql, /fi_tenant_external_integrations_select_tenant_member/);
    assert.match(sql, /fi_external_sync_status_select_tenant_member/);
    assert.match(sql, /fi_external_sync_events_select_tenant_member/);
    assert.match(sql, /fi_external_data_mappings_select_tenant_member/);

    assert.match(sql, /credentials_encrypted/);
    assert.match(sql, /grant insert on public\.fi_external_sync_events to service_role/);
    assert.match(sql, /revoke all on public\.fi_external_connector_credentials from public/);

    assert.match(sql, /idx_fi_tenant_external_integrations_tenant/);
    assert.match(sql, /idx_fi_tenant_external_integrations_provider/);
    assert.match(sql, /idx_fi_tenant_external_integrations_status/);
    assert.match(sql, /idx_fi_tenant_external_integrations_created_at/);

    for (const provider of ["pabau", "cliniko", "hubspot", "google_calendar", "stripe", "xero", "meta_ads"]) {
      assert.match(sql, new RegExp(provider));
    }
    for (const category of ["crm", "calendar", "finance", "marketing"]) {
      assert.match(sql, new RegExp(`'${category}'`));
    }
  });
});

describe("OnboardingOS Phase F1 — guided assist onboarding step", () => {
  it("includes Connect Existing Systems tip and next action", () => {
    const catalogPath = path.join(process.cwd(), "src/lib/onboarding-os/guidedAssistCatalog.ts");
    const src = fs.readFileSync(catalogPath, "utf8");
    assert.match(src, /onboarding_connect_existing_systems/);
    assert.match(src, /Connect existing systems/);
    assert.match(src, /next_connect_existing_systems/);
  });
});
