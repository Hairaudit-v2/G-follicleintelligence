# FI-ROLE-JOURNEY-BAKE-1

**Milestone:** `FI-ROLE-JOURNEY-BAKE-1`  
**Validates:** `FI-TRUST-LANDING-AND-SPINE-1`  
**Date:** 2026-07-13  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Plan:** [fi-role-journey-bake-1-plan.md](./fi-role-journey-bake-1-plan.md)

---

## 1. Executive verdict

### AMBER

The trust-and-spine implementation is **structurally sound** and **passes automated unit/navigation audits and the staff-mapping gate** against live Evolved data. It is **not yet ready for an unrestricted operational pilot** because:

1. **Live authenticated E2E could not be executed** on this host — `FI_E2E_DEMO_ADMIN_*` credentials return `invalid_credentials`; magic-link bootstrap fails TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) from Playwright's fetch path.
2. **Per-role live login journeys (8 roles) were not completed** — no per-role password or storage-state fixtures beyond demo admin (invalid locally).
3. **`FI_PIPELINE_V1_TENANT_ALLOWLIST` is unset** — Pipeline may still dual-run for Evolved until production env is set.
4. **Golden-patient UI spine E2E is added but skipped** without `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` fixture pair.

**Recommendation:** Continue **controlled bake** with Evolved staff on staging/production using valid credentials; resolve demo-admin credential rotation; set Pipeline V1 allowlist; then re-run Section B–F manual matrix before pilot sign-off.

---

## 2. Environment and fixture limitations

| Limitation | Impact | Status |
| ---------- | ------ | ------ |
| `FI_E2E_DEMO_ADMIN_PASSWORD` invalid / wrong user | All `@authenticated` E2E blocked | **Partial fix** — email now `manager@evolvedhair.com.au`; **password must be set manually** |
| Node fetch TLS on Windows (Playwright magic link) | Roster manager bootstrap blocked | **BLOCKED** |
| `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` unset | Golden-patient UI E2E skipped | **SKIP** |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` unset | V1-only Pipeline cutover unproven in env | **To verify** |
| No per-role E2E storage states (reception, consultant, nurse, doctor, finance) | Role landing matrix relies on unit tests + staff audit | **Partial** |
| Production-mode local host used (`npm run build && npm run start`) | Auth middleware active — unauthenticated `/front-desk` correctly redirects to login | Expected |

---

## 3. Staff mapping result (Section A)

**Command:** `npm run audit:staff-mapping` (updated to use `run-with-system-ca.mjs` for Windows TLS)

| Field | Result |
| ----- | ------ |
| Tenant | `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Active login operators | 9 |
| Missing `fi_staff` | **0** |
| Missing access signal | **0** |
| Verdict | **PASS** |

| Login (redacted) | Tenant membership | OS role | `fi_staff` | Staff role | Capability template | Grants | SA-1 enforcement | Duplicate | Action |
| ---------------- | ----------------- | ------- | ---------- | ---------- | ------------------- | ------ | ---------------- | ----------- | ------ |
| j***@hotmail.com | Present | — (member) | Present | Receptionist | Via `staff_role` | 0 | Role text (deferred template) | No | OK |
| r***@outlook.com | Present | — | Present | Receptionist | Via `staff_role` | 0 | Role text | No | OK |
| c***@icloud.com | Present | tenant_backend | Present | consultant | Via `staff_role` | 0 | Role text | No | OK |
| d***@gmail.com | Present | member | Present | Nurse | Via `staff_role` | 0 | Role text | No | OK |
| e***@gmail.com | Present | member | Present | Nurse | Via `staff_role` | 0 | Role text | No | OK |
| s***@gmail.com | Present | member | Present | Contractor Doctor / Hair Transplant Surgeon | Via `staff_role` | 0 | Role text | No | OK |
| m***@evolvedhair.com.au | Present | manager | Present | Manager | Via `staff_role` | 0 | Role text | No | OK |
| p***@evolvedhair.com.au | Present | member | Present | owner | Via `staff_role` | 0 | Role text | No | OK |
| s***@follicleintelligence.ai | Present | manager | Present | Manager | Via `staff_role` | 0 | Role text | No | OK |

**Notes:**

- Target **100% mapped active users: met (9/9)**.
- Global/tenant role templates count = 0 in audit output; access resolves via `staff_role` text + SA-1 runtime engine (grants=0 is expected when templates absent but role text present).
- Duplicate Dr Seetal identity resolved per [fi-workforce-live-data-cleanup-1.md](../fi-workforce-live-data-cleanup-1.md) (2026-07-06).
- **10 unlinked `fi_users`** remain (no `auth_user_id`) — not login-capable; out of bake gate scope.

---

## 4. Role landing matrix (Section B)

**Evidence:** `fiOsRoleLandingCore.test.ts` (unit), `fiOsRedirect.server.ts` (implementation), live E2E **blocked**.

| Role | Expected landing | Unit resolver | Live login | Safe `next` | Bad `next` | Re-login |
| ---- | ---------------- | ------------- | ---------- | ----------- | ---------- | -------- |
| Receptionist | `/front-desk` | PASS | BLOCKED | Not tested | Not tested | Not tested |
| Nurse | `/front-desk` | PASS | BLOCKED | — | — | — |
| Consultant | `/crm` | PASS | BLOCKED | — | — | — |
| Doctor / surgeon | `/doctor` | PASS | BLOCKED | — | — | — |
| Finance admin | `/financial-os` | PASS | BLOCKED | — | — | — |
| Clinic admin | Today | PASS | BLOCKED | — | — | — |
| Manager | Today | PASS | BLOCKED | — | — | — |
| Owner | Today | PASS | BLOCKED | — | — | — |
| Platform admin | `/fi-admin` | PASS (OS role) | BLOCKED | — | — | — |

**Confirmed by unit tests:**

- No ordinary clinic role defaults to `/cases`.
- OS roles map to job homes; finance `tenantAdminRole` maps to Money.
- Platform admin / auditor paths unchanged.

---

## 5. Navigation matrix by role (Section C)

**Evidence:** `fiOsNavigationGoLiveAudit.test.ts` — **all 5 GO_LIVE_NAV_ROLE_SCENARIOS pass** (receptionist, clinical_staff/nurse, surgeon, manager, platform_admin).

| Role | Primary rail (6 slots) | More drawer | Legacy LeadFlow | Money single door | Payments dead nav | Reports in More |
| ---- | ---------------------- | ----------- | --------------- | ----------------- | ----------------- | --------------- |
| Receptionist | PASS (unit) | PASS — admin surfaces hidden | PASS — `/leadflow` → `/crm` (unit) | PASS (unit) | PASS when flag off (unit) | PASS — not on rail |
| Consultant | PASS (synthetic CRM access) | PASS | PASS | N/A | PASS | PASS |
| Nurse | PASS | PASS | PASS | N/A | PASS | PASS |
| Doctor | PASS | PASS | PASS | N/A | PASS | PASS |
| Finance | PASS (finance_admin persona disables clinical tabs) | Not fully live-tested | PASS | PASS | PASS | PASS |
| Manager / owner | PASS | PASS — admin surfaces visible for manager | PASS | PASS | PASS | PASS |
| Platform admin | PASS | PASS | PASS | PASS | PASS | PASS |

**Live navigation:** BLOCKED (no authenticated session).

---

## 6. Journey results by role (Section D)

Scoring: 0–5 per dimension; **automated/unit proxy** where live journey blocked.

| Role | D# | Discover | Complete | Integrity | Efficiency | Appropriate | Consistent | Refresh | Tablet | Notes |
| ---- | -- | -------- | -------- | --------- | ---------- | ----------- | ---------- | ------- | ------ | ----- |
| Reception | D1 | 3 | — | — | — | 4 | — | — | — | Unit nav + landing; live Front desk E2E blocked (auth) |
| Consultant | D2 | 4 | — | — | — | 4 | — | — | — | Pipeline single door proven in unit tests |
| Nurse | D3 | 3 | — | — | — | 4 | — | — | — | Treatment imaging E2E fixture-gated; not run |
| Doctor | D4 | 3 | — | — | — | 4 | — | — | — | Procedure Day correctly off by flag |
| Finance | D5 | 4 | — | — | — | 4 | — | — | — | Money landing in unit; payment truth deferred |
| Manager | D6 | 4 | — | — | — | 4 | — | — | — | Team nav consolidated in unit audit |
| Owner | D7 | 3 | — | — | — | 3 | — | — | — | Reports via More in unit; Today orientation not live-scored |
| Platform admin | D8 | 4 | — | — | — | 4 | — | — | — | Cross-tenant patterns exist; not re-run |

---

## 7. Golden-patient UI-spine result (Section E)

| Check | Result |
| ----- | ------ |
| Unit contract (`goldenPatientSpineCore`) | **PASS** (3 tests) |
| UI path Pipeline → lead → patient | **SKIP** — fixtures not set |
| Reload linkage | **SKIP** |
| Re-login linkage | **SKIP** |
| Negative unlinked lead | **SKIP** — `FI_E2E_UNLINKED_LEAD_ID` not set |
| New E2E spec | `e2e/fi-trust-golden-patient-spine.spec.ts` added |

---

## 8. Responsive results (Section F)

| Viewport | Surface | Result |
| -------- | ------- | ------ |
| 1366×768 | Pipeline document H-scroll | **Unit + E2E spec exists** — E2E **BLOCKED** (auth) |
| 1024×768 | Pipeline board container | Same |
| 768×1024 | Front desk Today overflow | **BLOCKED** — redirects to login without auth |
| 1440×900 | Not run | BLOCKED |
| 12″ tablet landscape/portrait | Partial via unit contracts | BLOCKED live |

**Unit evidence:** Pipeline cutover tests require `pipeline-board-h-scroll`; go-live audit confirms six-slot mobile rail for all role profiles.

---

## 9. Defects found

| ID | Class | Finding |
| -- | ----- | ------- |
| BAKE-1-ENV-01 | P1 (env) | `FI_E2E_DEMO_ADMIN_*` invalid locally — authenticated E2E cannot run |
| BAKE-1-ENV-02 | P2 (env) | Playwright Supabase magic-link fetch hits TLS interception on Windows |
| BAKE-1-ENV-03 | P2 (config) | `FI_PIPELINE_V1_TENANT_ALLOWLIST` unset for Evolved |
| BAKE-1-ENV-04 | P2 (fixtures) | Golden-patient fixture IDs not configured for UI E2E |
| BAKE-1-CODE-01 | P3 | `npm run typecheck` fails on pre-existing test TS errors (not trust landing) |
| BAKE-1-CODE-02 | P3 | `fiOsRedirect.server.ts` passed `tenantAdminRole` as raw string to workspace derivation — **fixed in bake** |

No P0 trust/safety product defects observed in code or unit evidence.

---

## 10. Defects fixed during bake

| ID | Fix |
| -- | --- |
| BAKE-1-CODE-02 | `fiOsRedirect.server.ts` — normalize `tenantAdminRole` via `normalizeFiTenantAdminRole` before workspace profile derivation |
| BAKE-1-INFRA-01 | `playwright.config.ts` — include `fi-trust-*.spec.ts` in authenticated project `testMatch` |
| BAKE-1-INFRA-02 | `package.json` — `audit:staff-mapping` uses TLS-safe `run-with-system-ca.mjs` wrapper |
| BAKE-1-TEST-01 | Added `e2e/fi-trust-golden-patient-spine.spec.ts` (fixture-gated) |

---

## 11. Deferred findings

| ID | Class | Item | Owner / next milestone |
| -- | ----- | ---- | ---------------------- |
| DEF-MONEY-01 | P2 | Manual vs provider-confirmed payment labelling | `FI-TRUST-MONEY-AND-READINESS-1` |
| DEF-READY-01 | P2 | Deposit / financial clearance consistency | `FI-TRUST-MONEY-AND-READINESS-1` |
| DEF-PIPE-01 | P2 | Set `FI_PIPELINE_V1_TENANT_ALLOWLIST` for Evolved production | Ops / platform admin |
| DEF-E2E-01 | P2 | Rotate or restore valid `FI_E2E_DEMO_ADMIN_*` for CI/local | Platform ops |
| DEF-NURSE-01 | P2 | Treatment imaging discoverability from Front desk | Future bake after nurse live session |
| DEF-TC-01 | P3 | Pre-existing typecheck failures in nav test comparisons | Engineering hygiene |

---

## 12. Test evidence

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npm run lint` | **PASS** | 2 pre-existing warnings |
| `npm run typecheck` | **FAIL** | 6 errors — pre-existing test files + **fiOsRedirect fixed** |
| `npm run audit:staff-mapping` | **PASS** | 9/9 operators mapped |
| Trust unit bundle (71 tests) | **PASS** | Role landing, nav go-live, pipeline, golden spine |
| `e2e/fi-trust-role-landing.spec.ts` | **FAIL** | `invalid_credentials` |
| `e2e/fi-trust-pipeline-layout.spec.ts` | **FAIL** | Auth fixture timeout |
| `e2e/fi-ux-audit-labels.spec.ts` | **FAIL** | Unauthenticated — login redirect (production mode) |
| `e2e/fi-trust-golden-patient-spine.spec.ts` | **SKIP** | No lead/patient fixture IDs |
| Manual role journeys D1–D8 | **NOT RUN** | Credential gap |

---

## 13. Results table

| Role           | Landing | Navigation | Core journey | Reload integrity | Tablet | Result  |
| -------------- | ------: | ---------: | -----------: | ---------------: | -----: | ------- |
| Reception      |       4 |          4 |            — |                — |      — | Amber   |
| Consultant     |       4 |          4 |            — |                — |      — | Amber   |
| Nurse          |       4 |          4 |            — |                — |      — | Amber   |
| Doctor         |       4 |          4 |            — |                — |      — | Amber   |
| Finance        |       4 |          4 |            — |                — |      — | Amber   |
| Manager        |       4 |          4 |            — |                — |      — | Amber   |
| Owner          |       4 |          4 |            — |                — |      — | Amber   |
| Platform admin |       4 |          4 |            — |                — |      — | Amber   |

*Landing/navigation scores reflect **unit + go-live audit** evidence (4/5 = strong automated proof, live login not executed). Journey/tablet columns blank = blocked by environment.*

---

## 14. Evolved operational recommendation

1. **Run a 2-hour guided staff bake on staging/production** with real passwords for reception, consultant, nurse, doctor, and finance — use the plan's manual checklist (Sections B–F).
2. **Set production env:** `FI_PIPELINE_V1_TENANT_ALLOWLIST=c2615b95-b707-4485-aa5f-be8f78ec868a` if V1 cutover is approved.
3. **Restore E2E credentials** or adopt magic-link bootstrap with `NODE_EXTRA_CA_CERTS` for Playwright helpers.
4. **Configure** `FI_E2E_LEAD_ID` + `FI_E2E_PATIENT_ID` to a safe linked pair and re-run golden-patient E2E.
5. Do **not** enable Procedure Day or full Payments inbox for this pilot slice.

---

## 15. Readiness score movement

| Metric | Pre-bake (FI-PLATFORM-READINESS-AUDIT-1) | Post-bake |
| ------ | ---------------------------------------- | --------- |
| Weighted operational score | ~46 / 100 | ~**52 / 100** (+6) |
| Staff mapping gate | Implemented, unproven live | **PASS 9/9** |
| Role landing (code) | Implemented | **Unit proven** |
| Live role journeys | Not scored | **Blocked — unchanged confidence** |
| Golden-patient UI | Unit only | **E2E spec added, not executed** |

---

## 16. Recommended next milestone

**`FI-TRUST-MONEY-AND-READINESS-1`** — proceed after:

- Validated live role login matrix (minimum reception + consultant + finance),
- Golden-patient UI E2E pass on fixtures,
- Pipeline V1 allowlist decision for Evolved.

That milestone should address payment-source truth, deposit satisfaction, financial-clearance consistency, manual vs provider-confirmed payments, surgeon/staff/room readiness, and audited overrides — **not implemented in this bake**.

---

## Release decision

## AMBER

The new trust-and-spine implementation is suitable for **continued controlled bake testing**. Staff mapping is complete for active operators; navigation and landing logic are strongly supported by automated evidence. **Listed P1 environment blockers** (live authenticated validation, Pipeline V1 env, golden-patient UI proof) must be resolved before an operational pilot.

Do **not** mark GREEN based on unit tests alone.

---

## Acceptance criteria checklist

| # | Criterion | Status |
| - | --------- | ------ |
| 1 | Every tested role lands on expected destination | **Partial** — unit only |
| 2 | No clinic role defaults to Cases | **PASS** (unit) |
| 3 | Safe `next` without permission bypass | **Not live-tested** |
| 4 | Pipeline one staff-facing door | **PASS** (unit) |
| 5 | `/leadflow` → `/crm` | **PASS** (unit) |
| 6 | Money one nav door | **PASS** (unit) |
| 7 | Payments disabled state honest | **PASS** (unit) |
| 8 | Front desk discoverable for frontline | **PASS** (unit nav) |
| 9 | No inaccessible primary/More item clickable | **PASS** (go-live audit) |
| 10 | Active pilot users fully staff-mapped | **PASS** (9/9) |
| 11 | SA-1 not deferred for active pilot users | **PASS** (role text present) |
| 12 | Golden-patient linkage survives reload/re-login | **SKIP** (UI) |
| 13 | Pipeline H-scroll inside board | **Not live-tested** |
| 14 | Document root no H-overflow | **Not live-tested** |
| 15 | P0/P1 product defects resolved | **PASS** (none found in product code) |
| 16 | Automated vs manual evidence separated | **PASS** |
| 17 | No new modules introduced | **PASS** |
