# FI-HUBSPOT-INCREMENTAL-BACKUP-1 — Production deployment gate

**Evidence classification:** Privacy-safe operational metadata only  
**Date:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-incremental-production-gate.json`

**Does not claim Stage P2 GREEN.**

> **Superseded for programme status (2026-07-16):** Stage P2 later completed GREEN (`evidence-fi-hubspot-stage-p2-incremental-notes-proof.md`). FI-HUBSPOT-BACKUP-1 is closed **GREEN — COMPLETE** in `evidence-fi-hubspot-backup-1-final-closeout.md`. The “Stage P2 remains pending” wording below is historical to this gate only.

---

## 1. Verdict

### **GREEN TO PROCEED** (deployment + migration + P1 re-observation)

Stage P2 remains **pending** and was **not** executed.

---

## 2. Production deployment ID

`dpl_wPdpTJAMaAEFZcRRdtUSHvS24Jnf`

Inspector: https://vercel.com/fi-ai-ef8ee84f/g-follicleintelligence/wPdpTJAMaAEFZcRRdtUSHvS24Jnf

---

## 3. Production URL / alias

| Field | Value |
|-------|-------|
| Alias | `https://follicleintelligence.ai`, `https://www.follicleintelligence.ai` |
| Deployment URL | `g-follicleintelligence-2z9umh6rp-fi-ai-ef8ee84f.vercel.app` |
| Target | production |
| readyState | **READY** |
| Source | Vercel Git integration on `main` |
| buildingAt (epoch ms) | `1784169927085` |
| ready (epoch ms) | `1784170124993` |

---

## 4. Deployed SHA

`34ca0374daced118d391937b6ae55f16a86679e4`

---

## 5. Commit-stack verification

| Commit | Role | Ancestor of deployed SHA |
|--------|------|---------------------------|
| `24ece99b` | feat — watermarks + cutoffs | **Yes** |
| `bba82044` | test — resume/idempotency | **Yes** |
| `34ca0374` | audit — implementation evidence | **Yes** (HEAD) |

Also pushed with this stack (prior Stage P evidence, already local): `6ba5b623`, `bfae119b`.

| Pre-deploy | Value |
|------------|-------|
| Branch | `main` |
| Pre-deployment production SHA | `687410c158018a545de3025b9c1093ce6212653d` |
| Origin after push | `34ca0374` |
| Working tree | Unrelated untracked/local files present; **no uncommitted incremental-backup code** |

Pre-deploy checks: `test:hubspot-incremental` 21/21, engagement/primary regression 9/9, `typecheck` PASS, `check:migrations` PASS.

---

## 6. Migration result

| Field | Value |
|-------|-------|
| Local file | `supabase/migrations/202610189001_hubspot_incremental_backup_watermarks.sql` |
| Target project | Follicle Intelligence (`iqqvzgxoimxchhcnbzxl`) |
| Execution path | Supabase MCP `apply_migration` (additive DDL only; did **not** re-apply prior HubSpot staging migrations already present under 20260715* ledger rows) |
| MCP ledger version | `20260716024711` / name `hubspot_incremental_backup_watermarks` |
| Local version alignment row | `202610189001` recorded after apply (ledger hygiene; DDL not re-run) |
| Result | **SUCCESS** |
| Additive | **Yes** |

Note: Hosted HubSpot Phase O tables already existed under remote-only versions `20260715023341` / `20260715043733` / `20260715222930` (filename mismatch vs local `20261016*` / `20261017*`). Those were **not** re-pushed.

---

## 7. Schema verification

| Check | Result |
|-------|--------|
| `fi_external_hubspot_backup_watermarks` exists | PASS |
| Unique `(tenant_id, source_system, dataset)` | PASS (`fi_external_hubspot_backup_wa_tenant_id_source_system_datas_key`) |
| Watermark columns + FKs | PASS (table created per migration) |
| Sync-run columns: `backup_run_type`, `incremental_*` | PASS (6 columns present) |
| `uq_hubspot_incremental_active_run` | PASS |
| Notes staging unique `(tenant_id, integration_id, hubspot_record_id)` | PASS (pre-existing) |
| Watermark row count after deploy | **0** |
| Incremental runs after deploy | **0** |
| Phase O staging destructive change | **None** |

Privacy-safe schema queries only; no note bodies queried.

---

## 8. Production health

| Check | Result |
|-------|--------|
| Deployment still READY | PASS |
| Alias on new deployment | PASS (`follicleintelligence.ai`) |
| Build identity = `34ca0374` | PASS |
| HubSpot UUID errors (30m / 20m) | **None** |
| HubSpot route runtime error clusters (20–30m) | **None** |
| Concurrency-index errors on page load | **None observed** |

---

## 9. P1 re-observation matrix

Command: `npm run test:e2e:hubspot-production-smoke`  
Target: `https://follicleintelligence.ai`  
Timestamp UTC: `2026-07-16T02:54:02.337Z`  
Playwright: **11 passed** · Verdict: **GREEN**  
Local summary (not committed): `test-results/hubspot-production-smoke-summary.json`

| Axis | Result |
|------|--------|
| Platform admin | PASS |
| Low-role fail-closed | PASS |
| Valid batchId | PASS |
| Invalid batchId | PASS (harmless) |
| Legacy redirects (both) | PASS (no loops) |
| Backup & Sync | PASS (controls not clicked) |
| Audit & History | PASS |
| Configuration | PASS |
| Browser console | PASS |
| Network | PASS |
| Cross-tenant | PASS |
| Mutation guard | PASS |

---

## 10. Log review

During smoke window against `dpl_wPdpTJAMaAEFZcRRdtUSHvS24Jnf`:

- No hubspot error/fatal/warning log hits in filtered 20m window
- No new HubSpot UUID/database error clusters
- No incremental backup invocation artifacts

---

## 11. Production writes performed

| Write type | Count |
|------------|-------|
| HubSpot CRM objects created/updated | **0** |
| Incremental backup runs | **0** |
| Watermark rows created by deploy | **0** |
| Schedules added | **0** |
| DB DDL | Additive migration only |

---

## 12. Incremental runs performed

**0**

---

## 13. HubSpot test objects created

**0**

---

## 14. Schedule state

Unchanged. `vercel.json` has no HubSpot backup cron. LeadFlow `/api/cron/leadflow/process-hubspot-events` remains webhook drain only. No new schedule.

---

## 15. Remaining AMBER risks

| Risk | Notes |
|------|-------|
| Search API vs list property lag | Unchanged from implementation evidence |
| Archived notes outside Search path | Documented |
| Migration ledger dual version IDs | MCP `20260716024711` + aligned `202610189001`; schema verified once |
| Pending unrelated local migrations | `20261015120001`, `20261015120002` still pending vs remote; **out of this gate** |
| Evolved CLI tenant defaults | Explicit flags still required for multi-tenant |

---

## 16. Exact Stage P2 readiness verdict

### **GREEN TO PROCEED**

All Stage P2 readiness rules met: READY, SHA match, migration applied, schema verified, P1 GREEN, no production backup, no test objects, no new regression.

---

## 17. Exact next gate

Run the Stage P2 controlled notes proof using one non-patient **FI OS BACKUP TEST** note, explicit fixed UTC cutoffs, first incremental capture, identical-range idempotency replay, destination verification and watermark verification.

**Do not claim Stage P2 GREEN from this gate.**
