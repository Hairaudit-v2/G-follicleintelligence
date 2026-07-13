# FI-TRUST-E2E-AND-PIPELINE-1 — Audit plan

**Milestone:** `FI-TRUST-E2E-AND-PIPELINE-1`  
**Validates:** Operational trust automation + Pipeline V1 readiness (deferred from `FI-ROLE-JOURNEY-BAKE-1` and `FI-TRUST-MONEY-AND-READINESS-1`)  
**Date:** 2026-07-13  
**Mode:** Audit-first (Phase 1), then evidence-backed fixes + live bake (Phase 2)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)

---

## 1. Scope

### In scope

| Area | Surfaces / artifacts | Trust question |
| ---- | -------------------- | -------------- |
| Authenticated E2E | `e2e/fi-trust-role-landing.spec.ts`, `e2e/fi-trust-pipeline-layout.spec.ts`, `e2e/fi-trust-golden-patient-spine.spec.ts` | CI/local Playwright can prove role landing, pipeline layout, golden-patient spine without manual browser bakes |
| E2E credentials | `FI_E2E_DEMO_ADMIN_*`, `e2e/fixtures/auth.ts` | Fixture rotation documented; no `invalid_credentials` / TLS blockers |
| Pipeline V1 allowlist | `FI_PIPELINE_V1_TENANT_ALLOWLIST`, `/crm` vs `/leadflow` | Evolved production decision documented; single Pipeline door when allowlisted |
| Pipeline layout | H-scroll containment, document overflow | Desktop + tablet e2e asserts no page-level horizontal scroll |
| Nurse treatment discoverability | Front desk Today, Calendar quick filters | Treatment workflow reachable without hunting (DEF-NURSE-01 partial) |
| Staff mapping gate | `npm run audit:staff-mapping` | Remains 10/10 for active pilot operators |

### Out of scope

- Procedure Day product enablement (`FI_PROCEDURE_DAY_ENABLED` stays off)
- Payments inbox enablement (`FI_PAYMENTS_ENABLED` stays off unless ops approves)
- Full Money tree rewrite or new finance modules
- Pipeline V1 global cutover for all tenants
- Owner intelligence / patient portal / AI expansion
- Broad UX redesign

---

## 2. Roles to validate

| Priority | Role | Operator (Evolved) | Why |
| -------- | ---- | ------------------ | --- |
| **P0** | Platform ops | Credential holder | Restore E2E auth fixture |
| **P1** | Consultant | `manager@evolvedhair.com.au` | Pipeline V1 door + layout |
| **P1** | Nurse | `evieshackleton1@gmail.com` | Front desk + Calendar treatment filters |
| **P2** | Reception | `j***@hotmail.com` | Landing + pipeline redirect spot-check |
| **Defer** | Finance | `harsh@evolvedhair.com.au` | Signed off in FI-TRUST-MONEY-AND-READINESS-1 |

---

## 3. Environment flags

| Flag | Expected (pilot) | Bake impact |
| ---- | ---------------- | ----------- |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | **Decision required** — include or exclude Evolved UUID | Pipeline mount + `/leadflow` redirect |
| `FI_PAYMENTS_ENABLED` | `false` | No change to Money path |
| `FI_PROCEDURE_DAY_ENABLED` | `false` | Procedure Day hidden |
| `FI_E2E_BASE_URL` | production or staging HTTPS | Auth middleware fail-closed |
| `FI_E2E_DEMO_ADMIN_EMAIL` / `PASSWORD` | Valid rotated credentials | Authenticated project green |

**Compare local vs production:**

```bash
npm run compare:bake-env
```

---

## 4. Check matrix

| ID | Check | Route / artifact | Evidence |
| -- | ----- | ---------------- | -------- |
| E1 | E2E role landing spec | `e2e/fi-trust-role-landing.spec.ts` | CI/local PASS with valid credentials |
| E2 | E2E pipeline layout spec | `e2e/fi-trust-pipeline-layout.spec.ts` | No `documentElement` H-overflow |
| E3 | E2E golden-patient spine | `e2e/fi-trust-golden-patient-spine.spec.ts` | Fixture IDs wired or documented skip |
| P1 | Pipeline allowlist decision | Env + ops doc | Evolved UUID in allowlist or explicit defer |
| P2 | `/leadflow` → `/crm` when V1 on | Live consultant session | Soft redirect + single door |
| P3 | Pipeline board H-scroll contained | `/crm` | `pipeline-board-h-scroll` + e2e |
| N1 | Calendar treatment quick filters | `/calendar` nurse session | Consultations / PRP / Surgery filters |
| N2 | Front desk empty-state CTA | `/front-desk` | Treatment path discoverable or documented gap |
| S1 | Staff mapping gate | `audit:staff-mapping` | 10/10 PASS |

---

## 5. Evidence collection

### Automated (Phase 1 — safe)

**Trust E2E bundle (when credentials available):**

```bash
FI_E2E_BASE_URL=https://follicleintelligence.ai npx playwright test \
  e2e/fi-trust-role-landing.spec.ts \
  e2e/fi-trust-pipeline-layout.spec.ts \
  e2e/fi-trust-golden-patient-spine.spec.ts \
  --project=chromium-authenticated
```

**Staff mapping:**

```bash
npm run audit:staff-mapping
```

**Pipeline allowlist audit:**

```bash
rg -n "FI_PIPELINE_V1_TENANT_ALLOWLIST" .env.example app src/lib/crm
```

### Live browser (Phase 2)

1. **Consultant** — `/crm` Pipeline door; confirm allowlist behaviour; H-scroll containment.
2. **Nurse** — `/front-desk` + `/calendar`; treatment filter chips; compare with DEF-NURSE-01 baseline.
3. **Reception** — `/leadflow` redirect if allowlist on.

---

## 6. Gaps to close (from prior milestones)

| ID | Source | Finding |
| -- | ------ | ------- |
| DEF-E2E-01 | FI-ROLE-JOURNEY-BAKE-1 | `invalid_credentials` / auth fixture timeout |
| DEF-PIPE-01 | FI-ROLE-JOURNEY-BAKE-1 | Evolved `FI_PIPELINE_V1_TENANT_ALLOWLIST` not decided in production |
| DEF-NURSE-01 | FI-ROLE-JOURNEY-BAKE-1 | Treatment workflow discoverability from empty Today board — **Closed** 2026-07-14 (nurse live bake) |
| BAKE-1-INFRA-01 | FI-ROLE-JOURNEY-BAKE-1 | `fi-trust-*.spec.ts` in authenticated project — verify still wired |

---

## 7. Release decision rubric

| Verdict | Conditions |
| ------- | ---------- |
| **GREEN** | E1–E2 PASS in CI or documented local PASS; P1 decision recorded; P2–P3 live PASS if allowlist on; S1 PASS |
| **AMBER** | E2E blocked by credentials but pipeline/nurse live PASS; allowlist decision deferred with ops sign-off |
| **RED** | Pipeline regression (dual door, H-overflow); E2E credentials leaked; staff mapping regression |

---

## 8. Recommended bake sequence

1. **Audit credentials** — verify `FI_E2E_DEMO_ADMIN_*` in secure store; rotate if expired.
2. **Pipeline allowlist decision** — platform admin + Evolved clinic lead: add Evolved UUID or document defer.
3. **Run authenticated E2E** — role landing + pipeline layout locally against production build.
4. **Consultant live bake** — Pipeline door + scroll containment.
5. **Nurse live bake** — Calendar filters + front-desk treatment path.

### Phase 1 status (2026-07-13)

**GREEN** — see [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md). DEF-E2E-01 and DEF-PIPE-01 closed; trust E2E bundle 6 PASS / 0 FAIL / 2 SKIP on production; staff mapping 10/10.

### Suggested first action for user (Phase 2)

**Done (2026-07-14):** Nurse live bake closed **DEF-NURSE-01** — see [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md) nurse matrix (N1/N2 PASS). Consultant Pipeline door already covered by trust E2E + prior live evidence.

---

## 9. Related docs

- [fi-trust-money-and-readiness-1.md](./fi-trust-money-and-readiness-1.md) — prior milestone close-out
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md) — deferred gaps §11, §16
- [fi-trust-landing-and-spine-1.md](./fi-trust-landing-and-spine-1.md) — landing + pipeline foundation
- [e2e/README.md](../../e2e/README.md) — authenticated fixture wiring
