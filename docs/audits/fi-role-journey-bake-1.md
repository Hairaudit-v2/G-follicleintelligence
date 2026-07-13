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

1. **P1 role-gating defect (live browser):** `/crm` and `/crm/leads/{id}` **redirect to `/cases`** for **clinic manager** (`fi_users.role=manager`) and **platform-admin impersonation without CRM shell role** — but **PASS for `crm_operator`** (Jesika Watts impersonation). Golden-patient spine **works for frontline CRM roles**; managers/admins are wrongly ejected.
2. **Receptionist post-login landing (P2):** Jesika/`crm_operator` impersonation lands on **Today home**, not **`/front-desk`** (unit expectation).
3. **Live authenticated Playwright E2E** still blocked locally by credential/TLS gaps.

**Recommendation:** Re-bake **manager/consultant** CRM shell access after **BAKE-1-LIVE-01** fix; align receptionist live landing to `/front-desk`; re-run consultant/finance live sessions.

---

## 1b. Live browser bake (Roslyn session)

**Date:** 2026-07-13  
**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Tool:** cursor-ide-browser MCP (authenticated Cursor Glass session)

### Session identity (resolved)

| Field | Observed |
| ----- | -------- |
| Requested persona | Roslyn admin / Evolved receptionist (`r***@outlook.com`) |
| **Actual session** | **Platform admin** impersonating **"auditor"** |
| Shell label | `Platform admin workspace` · greeting "Good afternoon, auditor" |
| Impersonation UI | `Exit impersonation` button visible |
| Profile menu | `PLATFORM ADMIN WORKSPACE` · System administration |

**Conclusion:** Roslyn receptionist bake **not executed** — session is platform-operator impersonation, not frontline staff login.

### Check matrix (platform-admin impersonation / auditor)

| # | Check | Result | Final URL | Notes |
| - | ----- | ------ | --------- | ----- |
| 1 | Post-login landing | **PASS** | `/fi-admin/c2615b95-…` | **Home/Today** — not `/cases` |
| 2 | Primary rail (6 slots) | **PASS** | — | Today · Calendar · Patients · Front desk · Team · More |
| 3 | `/crm` Pipeline | **FAIL (P1)** | `/cases` | Title briefly "Pipeline", then **redirects to Surgery** |
| 4 | `/leadflow` → `/crm` | **PASS** | `/crm` → settles `/cases` | Legacy redirect works; destination still ejected to `/cases` |
| 5 | Golden lead detail hold | **FAIL (P1)** | `/cases` | `/crm/leads/c9a58f3d-…` briefly renders, then **redirects to `/cases`** |
| 6 | Lead → patient link | **BLOCKED** | — | Lead detail never holds; cannot complete click-through |
| 7 | Golden patient direct | **PASS** | `/patients/287348d5-…` | Full patient workspace; 6 linked leads visible in history |
| 8 | Reload lead integrity | **FAIL (P1)** | `/cases` | Re-navigation to golden lead repeats redirect |
| 9 | Pipeline layout 1366×768 | **BLOCKED** | `/cases` | `docOverflow=0` but `.pipeline-board-h-scroll` absent — never on Pipeline |
| 10 | `/financial-os` Money | **PASS** | `/financial-os` | Title "Money"; honest manual-tracking banner |
| 11 | `/payments` disabled | **PASS** | `/payments` | "FI_PAYMENTS_ENABLED is off" + link to Money |
| 12 | `/front-desk` Today board | **PASS** | `/front-desk` | Front desk current; Today board loads |

### Prior clinic-manager session (same day)

Earlier live bake as **Clinic manager** (`manager@evolvedhair.com.au`) showed the **same P1** on golden lead detail and a **collapsed 4-slot rail** (Calendar/Patients in More at narrower width). `/leadflow` → `/crm` passed once production redirect deployed.

### Role-gating P1 finding (revised after Jesika session)

The golden lead → `/cases` redirect reproduces for **clinic manager** and **non-CRM platform impersonation**, but **does not reproduce** when impersonating **`crm_operator`** (Jesika Watts, `j***@hotmail.com`). Root cause is **`getCrmShellPageSession`** in `crmShellAccess.ts`: only `isCrmShellNavRole()` + selected tenant-admin roles pass; `manager`/`member` without CRM entitlement fall through to **`redirect(/cases)`**.

---

## 1c. Live browser bake (Jesika Watts / crm_operator)

**Date:** 2026-07-13  
**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Tool:** cursor-ide-browser MCP (platform-admin **impersonation** session)

### Session identity (resolved)

| Field | Observed |
| ----- | -------- |
| Requested persona | **Jesika Watts** — `crm_operator` / Receptionist (`j***@hotmail.com`) |
| Shell chrome | `Platform admin workspace` + `Exit impersonation` (impersonation wrapper) |
| CRM behaviour evidence | Owner picker lists **Jesica Watt · Receptionist**; full Pipeline + lead detail access |
| Greeting on tenant home | Still **"Good afternoon, auditor"** on first load — shell label lags impersonation target |

**Conclusion:** Functional **`crm_operator`** impersonation confirmed by CRM access pattern (contrasts with manager/auditor sessions). Not a raw staff password login.

### Check matrix (crm_operator impersonation)

| # | Check | Result | Final URL | Notes |
| - | ----- | ------ | --------- | ----- |
| 1 | Post-login landing | **PARTIAL** | `/fi-admin/c2615b95-…` | **Today home** — not `/cases`, but **not `/front-desk`** (unit expectation) |
| 2 | Primary rail (6 slots) | **PASS** | — | Today · Calendar · Patients · Front desk · Team · More |
| 3 | `/crm` Pipeline hold | **PASS** | `/crm` | Full Pipeline board loads; **no redirect to `/cases`** |
| 4 | `/leadflow` → `/crm` | **PASS** | `/crm` | Legacy redirect; stays on Pipeline |
| 5 | Golden lead detail hold | **PASS** | `/crm/leads/c9a58f3d-…` | Lead + patient ID `287348d5-…` visible; **no ejection** |
| 6 | Patient direct URL | **PASS** | `/patients/287348d5-…` | Full patient workspace; 6 linked leads |
| 7 | Reload lead integrity | **PASS** | `/crm/leads/c9a58f3d-…` | Re-navigation holds; linkage persists |
| 8 | `/front-desk` Today board | **PASS** | `/front-desk` | Front desk current; board loads |
| 9 | `/financial-os` Money | **PASS** | `/financial-os` | Accessible under impersonation |
| 10 | `/payments` disabled | **PASS** | `/payments` | Honest `FI_PAYMENTS_ENABLED is off` state |
| 11 | Pipeline layout 1366×768 | **PARTIAL** | `/crm` | `docOverflow=0`; `.pipeline-board-h-scroll` not in DOM at default view |

### Comparison to clinic manager

| Role context | `/crm` hold | Golden lead hold |
| ------------ | ----------- | ---------------- |
| Clinic manager (`manager`) | **FAIL** → `/cases` | **FAIL** → `/cases` |
| Platform admin / auditor impersonation | **FAIL** → `/cases` | **FAIL** → `/cases` |
| **Jesika / `crm_operator` impersonation** | **PASS** | **PASS** |

**Verdict:** BAKE-1-LIVE-01 is **role-gating (P1)**, not a global Pipeline outage.

---

## 1d. Live browser bake (Paul Green / owner) — post-deploy verification

**Date:** 2026-07-13 (after deploy `f509ad55` + `116a7882`)  
**Host:** `https://follicleintelligence.ai`  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Tool:** cursor-ide-browser MCP (platform-admin **impersonation** of Paul Green)

### Session identity (resolved)

| Field | Observed |
| ----- | -------- |
| Target persona | **Paul Green** — `paul@evolvedhair.com.au` (`fi_users.role=member`, `fi_staff.staff_role=owner`) |
| Auth user id | `d10045e8-3984-4439-ad15-1fe376830463` |
| Greeting | **"Good afternoon, Paul"** — not auditor |
| Profile email (CDP) | **`paul@evolvedhair.com.au`** — not `auditor@hairaudit.com` |
| Workspace badge | **Director workspace** / **Director view** — not Platform admin |
| Impersonation UI | **PASS** — `Exit impersonation` + body text "impersonating paul" |

**Conclusion:** **BAKE-1-LIVE-04 fix verified** — shell chrome shows impersonation **target** identity. Owner CRM shell (**BAKE-1-LIVE-01**) also holds on production.

### Check matrix (owner impersonation)

| # | Check | Result | Final URL | Notes |
| - | ----- | ------ | --------- | ----- |
| 1 | Greeting not auditor | **PASS** | `/fi-admin/c2615b95-…` | `Good afternoon, Paul` |
| 2 | Profile email | **PASS** | — | `paul@evolvedhair.com.au` |
| 3 | Workspace badge | **PASS** | — | Director workspace (owner `fi_staff`) |
| 4 | Impersonation banner | **PASS** | — | Exit impersonation visible |
| 5 | Post-login landing | **PASS** | `/fi-admin/c2615b95-…` | **Today home** — not `/cases` |
| 6 | `/crm` Pipeline hold | **PASS** | `/crm` | Title Pipeline; no redirect |
| 7 | Golden lead detail hold | **PASS** | `/crm/leads/c9a58f3d-…` | SMOKETEST lead + patient `287348d5-…`; no ejection |

### Updated comparison (post-fix)

| Role context | Shell identity | `/crm` hold | Golden lead hold |
| ------------ | -------------- | ----------- | ---------------- |
| Platform admin / auditor (pre-fix) | **FAIL** — initiator chrome | **FAIL** → `/cases` | **FAIL** → `/cases` |
| **Paul / owner impersonation (post-fix)** | **PASS** — Paul + Director | **PASS** | **PASS** |
| Jesika / `crm_operator` impersonation | **PARTIAL** (pre-04: auditor greeting) | **PASS** | **PASS** |
| Clinic manager (`manager`) | Not re-baked post-01 | **Expected PASS** | **Expected PASS** |

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
| Receptionist | `/front-desk` | PASS | **PARTIAL** (live: Today home, not `/cases`) | Not tested | Not tested | Not tested |
| Nurse | `/front-desk` | PASS | BLOCKED | — | — | — |
| Consultant | `/crm` | PASS | BLOCKED | — | — | — |
| Doctor / surgeon | `/doctor` | PASS | BLOCKED | — | — | — |
| Finance admin | `/financial-os` | PASS | BLOCKED | — | — | — |
| Clinic admin | Today | PASS | BLOCKED | — | — | — |
| Manager | Today | PASS | BLOCKED | — | — | — |
| Owner | Today | PASS | **PASS** (live: Paul impersonation → Today) | — | — | — |
| Platform admin | `/fi-admin` | PASS (OS role) | **PASS** (live: Today home) | — | — | — |

**Live browser (2026-07-13):** Paul **owner** impersonation (post-`f509ad55`): greeting **Paul**, Director workspace, `paul@evolvedhair.com.au`, Pipeline + golden lead **PASS**. `crm_operator` (Jesika): lands **Today** not `/front-desk`; Pipeline + golden lead **PASS**.

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

**Live navigation:** **Partial** — `crm_operator` impersonation: 6-slot rail, Pipeline, golden lead, Front desk, Money, payments-disabled **PASS**. Manager/auditor impersonation: **CRM FAIL** → `/cases`.

---

## 6. Journey results by role (Section D)

Scoring: 0–5 per dimension; **automated/unit proxy** where live journey blocked.

| Role | D# | Discover | Complete | Integrity | Efficiency | Appropriate | Consistent | Refresh | Tablet | Notes |
| ---- | -- | -------- | -------- | --------- | ---------- | ----------- | ---------- | ------- | ------ | ----- |
| Reception | D1 | 4 | 4 | 4 | — | 4 | 4 | 4 | — | Live `crm_operator`: Pipeline + golden lead PASS; landing Today not `/front-desk` |
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
| UI path Pipeline → lead → patient | **PASS** (`crm_operator` live) · **FAIL** (manager/auditor live) |
| Reload linkage | **PASS** (`crm_operator`) · **FAIL** (manager/auditor) |
| Re-login linkage | **NOT TESTED** |
| Patient direct URL | **PASS** — `/patients/287348d5-…` holds with linked leads |
| Negative unlinked lead | **SKIP** — `FI_E2E_UNLINKED_LEAD_ID` not set |
| New E2E spec | `e2e/fi-trust-golden-patient-spine.spec.ts` added |

---

## 8. Responsive results (Section F)

| Viewport | Surface | Result |
| -------- | ------- | ------ |
| 1366×768 | Pipeline document H-scroll | **PARTIAL PASS** — `crm_operator`: `docOverflow=0` on `/crm`; manager blocked |
| 1024×768 | Pipeline board container | **BLOCKED** (same P1) |
| 768×1024 | Front desk Today overflow | **PASS** (live) — `/front-desk` holds at default width |
| 1440×900 | Not run | BLOCKED |
| 12″ tablet landscape/portrait | Partial via unit contracts | BLOCKED live |

**Live evidence (1366×768 CDP):** `documentElement.scrollWidth - clientWidth = 0` on redirected Surgery page; `.pipeline-board-h-scroll` not present.

---

## 9. Defects found

| ID | Class | Finding |
| -- | ----- | ------- |
**Live evidence (1366×768 CDP, `crm_operator`):** `documentElement.scrollWidth - clientWidth = 0` on Pipeline; board container class not mounted at default Pipeline view.

| BAKE-1-LIVE-01 | **P1 — verified live** | Owner (`member`+`fi_staff.owner`) Pipeline + golden lead **PASS** on production (Paul session) |
| BAKE-1-LIVE-04 | **P0 — verified live** | Paul impersonation shows target chrome (Paul, Director, `paul@evolvedhair.com.au`); impersonation banner retained |
| BAKE-1-LIVE-02 | P2 | Roslyn receptionist session not achieved — impersonation landed on platform admin / auditor |
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
| BAKE-1-LIVE-04 | `resolveEffectiveTenantAuthUserIdFromSession` for Today greeting, profile email, workspace profile; owner `fi_staff` → director workspace |
| BAKE-1-LIVE-01 | Extended `CRM_SHELL_NAV_ROLES_LOWER` (manager/owner/consultant) + `fi_staff.staff_role` CRM shell fallback in `crmShellAccess.ts` |
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
| Reception      |       4 |          5 |            4 |                4 |      — | **Amber** (live `crm_operator`; landing not `/front-desk`) |
| Consultant     |       4 |          4 |            — |                — |      — | Amber   |
| Nurse          |       4 |          4 |            — |                — |      — | Amber   |
| Doctor         |       4 |          4 |            — |                — |      — | Amber   |
| Finance        |       4 |          4 |            — |                — |      — | Amber   |
| Manager        |       5 |          4 |            2 |                1 |      — | **Amber** (live landing PASS; golden lead FAIL) |
| Owner          |       4 |          4 |            — |                — |      — | Amber   |
| Platform admin |       5 |          5 |            3 |                1 |      — | **Amber** (live: 6-slot rail, Money, Front desk; CRM FAIL) |

*Landing/navigation scores: unit + go-live audit (4/5) unless noted with live browser evidence (5/5). Manager/platform-admin live rows include 2026-07-13 production browser bake. Journey/reload: golden-patient lead detail FAIL = 1–2/5.*

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

The new trust-and-spine implementation is suitable for **continued controlled bake testing**. **BAKE-1-LIVE-01** fix applied in code (manager/consultant CRM shell); **live re-bake pending**. Receptionist live landing still mismatches unit (`/front-desk` vs Today).

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
| 12 | Golden-patient linkage survives reload/re-login | **PASS** (`crm_operator` live) · **FAIL** (manager live) |
| 13 | Pipeline H-scroll inside board | **BLOCKED** — Pipeline never holds on production |
| 14 | Document root no H-overflow | **Not tested on Pipeline** (redirect blocks) |
| 15 | P0/P1 product defects resolved | **PASS** (none found in product code) |
| 16 | Automated vs manual evidence separated | **PASS** |
| 17 | No new modules introduced | **PASS** |
