# FI-TRUST-E2E-AND-PIPELINE-1

**Status:** **GREEN** — authenticated trust E2E + Pipeline allowlist + DEF-NURSE-01 nurse live bake PASS  
**Date:** 2026-07-13  
**Phase 1 re-verified:** 2026-07-13 — independent re-run 6 PASS / 0 FAIL / 2 SKIP; Vercel production + preview allowlist confirmed (`hasEvolved: true`); staff mapping 10/10  
**Nurse live bake:** 2026-07-14 — DEF-NURSE-01 **Closed** (`evieshackleton1` / Nurse workspace on production)  
**Depends on:** FI-TRUST-MONEY-AND-READINESS-1, FI-ROLE-JOURNEY-BAKE-1 (DEF-E2E-01, DEF-PIPE-01)  
**Plan:** [fi-trust-e2e-and-pipeline-1-plan.md](./fi-trust-e2e-and-pipeline-1-plan.md)

## Goal

Prove operational trust automation: authenticated Playwright can validate role landing, Pipeline layout containment, and golden-patient CRM spine without manual browser bakes. Close DEF-E2E-01 (`invalid_credentials`) and document Pipeline V1 allowlist readiness.

---

## Environment audit

| Variable | Local `.env.local` | Plan requirement | Status |
| -------- | ------------------ | ---------------- | ------ |
| `FI_E2E_BASE_URL` | `http://localhost:3000` (overridden to production for bake) | HTTPS production or staging | **PASS** — bake used `https://follicleintelligence.ai` |
| `FI_E2E_TENANT_ID` | `c2615b95-b707-4485-aa5f-be8f78ec868a` | Evolved UUID | **PASS** |
| `FI_E2E_DEMO_ADMIN_EMAIL` | `manager@evolvedhair.com.au` | Valid rotated credentials | **PASS** — login succeeds (DEF-E2E-01 **closed**) |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | Set (non-placeholder) | Valid rotated credentials | **PASS** |
| `FI_E2E_LEAD_ID` | `c9a58f3d-e1e4-4187-9986-59faed41565d` | SMOKETEST golden lead | **PASS** |
| `FI_E2E_PATIENT_ID` | `287348d5-18bd-4434-9bab-7caafacbfe86` | SMOKETEST golden patient | **PASS** |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | Evolved UUID included | Evolved UUID on production + preview | **PASS** — local + Vercel production/preview confirmed (2026-07-13) |
| `FI_E2E_UNLINKED_LEAD_ID` | Unset | Optional negative case | **SKIP** |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | Unset | Optional role-home assert | **SKIP** |

**Prior blocker (DEF-E2E-01):** `invalid_credentials` from FI-ROLE-JOURNEY-BAKE-1 — **resolved**. Current `manager@evolvedhair.com.au` credentials authenticate against production. No TLS wrapper needed for Playwright (browser handles TLS); `run-with-system-ca.mjs` used only for `audit:staff-mapping`.

### Pipeline V1 allowlist sign-off (DEF-PIPE-01)

| Surface | `FI_PIPELINE_V1_TENANT_ALLOWLIST` | Evolved UUID `c2615b95-…868a` |
| ------- | --------------------------------- | ----------------------------- |
| Local `.env.local` | **Set** | **Present** |
| Vercel **production** | **Set** (sensitive; added ~6h before sign-off) | **Present** — `vercel env run -e production` |
| Vercel **preview** | **Set** | **Present** — `vercel env run -e preview` |

**Verification commands (2026-07-13):**

```bash
# List var presence (encrypted values — no plaintext in output)
npx vercel env ls production
npx vercel env ls preview

# Live value check (Evolved UUID only — do not log full allowlist in tickets)
npx vercel env run -e production -- node -e "const v=process.env.FI_PIPELINE_V1_TENANT_ALLOWLIST||''; console.log(v.includes('c2615b95-b707-4485-aa5f-be8f78ec868a')?'PRESENT':'ABSENT')"
```

**Sync actions:** None required — Evolved UUID already on production and preview allowlists. No `--vercel` / `--vercel-update` run.

**DEF-PIPE-01:** **Closed** — production allowlist includes Evolved; E2E P1 (Enquiries board mounted) + env sign-off align.

---

## E2E trust bundle — production

**Command:**

```bash
FI_E2E_BASE_URL=https://follicleintelligence.ai \
FI_E2E_BROWSERS=chromium \
npm run test:e2e -- \
  --project=chromium-authenticated \
  e2e/fi-trust-role-landing.spec.ts \
  e2e/fi-trust-pipeline-layout.spec.ts \
  e2e/fi-trust-golden-patient-spine.spec.ts
```

**Note:** `fi-trust-role-landing.spec.ts` also matches the public `chromium` project (`@authenticated` grep); both projects ran. All executable cases **PASS**.

### Results by spec (`chromium-authenticated`)

| Spec | Pass | Fail | Skip | Notes |
| ---- | ---- | ---- | ---- | ----- |
| `fi-trust-role-landing.spec.ts` | 2 | 0 | 1 | Skip: optional `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` |
| `fi-trust-pipeline-layout.spec.ts` | 2 | 0 | 0 | Desktop + tablet H-scroll containment |
| `fi-trust-golden-patient-spine.spec.ts` | 2 | 0 | 1 | Skip: `FI_E2E_UNLINKED_LEAD_ID` unset |
| **Total (authenticated project)** | **6** | **0** | **2** | |

### Check matrix (automated)

| ID | Check | Result | Evidence |
| -- | ----- | ------ | -------- |
| E1 | Role landing | **PASS** | Post-login not `/cases`; `/leadflow` → `/crm` |
| E2 | Pipeline layout | **PASS** | No `documentElement` H-overflow; `pipeline-board-h-scroll` at tablet |
| E3 | Golden-patient spine | **PASS** | Lead `c9a58f3d-…` links to patient `287348d5-…`; reload + re-navigation stable |
| S1 | Staff mapping | **PASS** | `operators_with_login: 10`, `missing_fi_staff: 0` |
| P1 | Pipeline allowlist | **PASS** | Local + Vercel production/preview include Evolved UUID; E2E Enquiries board mounts |
| P2 | `/leadflow` redirect | **PASS** | Unconditional soft-redirect to `/crm` (E1) |
| P3 | Pipeline H-scroll | **PASS** | E2 |

---

## Failure diagnosis and fix (Phase 2)

### Initial run — 2 failures (P2 test)

| Failure | Class | Root cause |
| ------- | ----- | ---------- |
| `lead detail links to canonical patient workspace` | **P2** | Locator `a[href*="/patients/{id}"]`.first()` matched CRM header **Health record** link (`/patients/{id}/twin`) before **Profile →** (`/patients/{id}`). Consultant persona lacks `patient_twin`; navigation landed on `module-unavailable?featureDenied=patient_twin`. |

### Fix applied

**File:** `e2e/fi-trust-golden-patient-spine.spec.ts`

- Added `patientProfileLink()` helper targeting exact profile href (excludes `/twin`).
- Re-run: **6/6 executable authenticated tests PASS**.

No app-code change required — linkage and profile route are correct; test selector was ambiguous.

---

## Nurse live bake — DEF-NURSE-01 (2026-07-14)

**Session:** Production `https://follicleintelligence.ai` · Evolved `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Identity:** Impersonating `evieshackleton1` (`evieshackleton1@gmail.com`) · **Nurse workspace** · greeting chip `E`  
**Verdict:** **PASS** — treatment workflow discoverable from Front desk + Calendar; no P0/P1 defects

### Check matrix (live)

| ID | Check | Result | Evidence |
| -- | ----- | ------ | -------- |
| Landing | Bare tenant → role home | **PASS** | `/fi-admin/{tenant}` soft-redirects to `/front-desk` |
| N2 | Front desk treatment CTA | **PASS** | Desk actions always visible: Take payment → `/payments`, Find patient, New booking → `/calendar`, **Open calendar** → `/calendar`. Empty-day component (`FrontDeskTodayEmptyDay`) primary CTA **Open calendar** + secondary Take payment (board had arriving-soon cards today — empty-state not live-observed; code + actions bar cover path). |
| N1 | Calendar treatment quick filters | **PASS** | Quick filters strip: Consultations (`type=consultation`), PRP (`type=prp`), Surgery (`type=surgery`), Follow-up. Direct nav filters board without dead ends (Surgery keeps 2 HT surgeries; Consultations/PRP empty week with 0 appointments). |
| Sanity | Tomorrow board | **PASS** | `/front-desk/tomorrow` loads; **Open calendar** CTA present; empty schedule copy clear |
| Sanity | Patients | **PASS** | Journey snapshot + stages; treatment paths via Consultations / Surgery / Open Calendar |

### Defects

| Severity | Finding | Disposition |
| -------- | ------- | ----------- |
| — | None for DEF-NURSE-01 | — |
| P3 (out of scope) | SMOKETEST today surgeries flag “Appointment missing room assignment” | Fixture/data — not treatment discoverability |

**DEF-NURSE-01:** **Closed** — Calendar PRP/Consultations/Surgery filters usable; Front desk surfaces calendar treatment path without hunting (prior gap: empty Today board alone had no CTA — now empty-state + persistent Desk actions bar).

---

## Deferred / out of scope (remaining)

| ID | Item | Status |
| -- | ---- | ------ |
| DEF-NURSE-01 | Treatment workflow discoverability (Front desk / Calendar) | **Closed** — nurse live bake PASS 2026-07-14 |
| DEF-PIPE-01 | Evolved on production `FI_PIPELINE_V1_TENANT_ALLOWLIST` | **Closed** — Vercel production + preview verified 2026-07-13 |

---

## Release verdict

| Rubric | Assessment |
| ------ | ---------- |
| **GREEN** | E1–E3 PASS; S1 PASS; P1–P3 PASS; DEF-E2E-01 + DEF-PIPE-01 + **DEF-NURSE-01** closed |
| Blockers | None for trust E2E automation, Pipeline V1 cutover, or nurse treatment discoverability |

---

## Recommended next action

1. **CI:** Wire `chromium-authenticated` trust bundle in CI once `FI_E2E_DEMO_ADMIN_*` secrets are in the deployment secret store.
2. **Optional:** Set `FI_E2E_UNLINKED_LEAD_ID` for negative linkage case; set `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX=/crm` for consultant role-home assert.
3. **Optional:** Reception landing spot-check (`crm_operator` → `/front-desk`) if still desired outside this milestone.

---

## Related docs

- [fi-trust-e2e-and-pipeline-1-plan.md](./fi-trust-e2e-and-pipeline-1-plan.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md) — DEF-E2E-01 origin
- [fi-trust-money-and-readiness-1.md](./fi-trust-money-and-readiness-1.md) — prior milestone
- [e2e/README.md](../../e2e/README.md)
