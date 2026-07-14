# FI-EVOLVED-MUTATION-DEPTH-1 — Audit plan

**Milestone:** `FI-EVOLVED-MUTATION-DEPTH-1`  
**Status:** **IN PROGRESS**  
**Date:** 2026-07-14  
**Mode:** Live production bake (Decision B host)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Prior (GREEN scoped):** `FI-EVOLVED-OPERATIONAL-PILOT-1` at `a8052a2b`

---

## 1. Core question

**Do SMOKETEST-only core mutations for Consultant / Nurse / Finance survive hard reload — and can at least one ordinary login use a raw password?**

Reception check-in + reload already **PASS** in the operational pilot. This milestone deepens mutation+reload on the remaining role paths.

---

## 2. In scope

| Surface / action | Role | Notes |
| ---------------- | ---- | ----- |
| Pipeline stage-move + hard reload | Consultant | SMOKETEST lead or known golden/SMOKETEST patient only |
| Safe clinical path mutation + hard reload | Nurse | No live-patient capture; SMOKETEST / fixture only |
| Money / invoice safe path + hard reload | Finance | Only if mutation is reversible / fixture-safe |
| Doctor mutation | Doctor | Only if safe fixture path exists; otherwise skip |
| ≥1 raw-password login | Reception or Consultant preferred | Observability / purity vs impersonation |

All mutations **SMOKETEST-only** (or explicitly known golden lead/patient). No production patient data writes.

---

## 3. Out of scope

- Soft-nav P2 backlog (pilot observe notes)
- CI polish / hygiene follow-ups
- HR-DRIFT-01 (gated monitor / Ops — not this bake)
- Procedure Day automation expansion
- Stripe / payment-provider expansion
- New modules or nav restructuring
- Expanding frozen pilot surface list

---

## 4. Check matrix

| ID | Check | GREEN signal |
| -- | ----- | ------------ |
| MD-01 | Consultant Pipeline stage-move + hard reload | Stage (or equivalent status) holds after full reload; no silent revert |
| MD-02 | Nurse safe clinical mutation + hard reload | Mutation holds after reload on SMOKETEST/fixture path |
| MD-03 | Finance Money/invoice safe mutation + hard reload | Mutation holds if exercised; else documented SKIP with reason |
| MD-04 | Doctor safe mutation (optional) | PASS if safe fixture; else SKIP |
| MD-05 | ≥1 raw-password staff login | Ordinary login without impersonation wrapper for Reception or Consultant (or documented alternative role) |
| MD-06 | No P0 | No identity, security, or patient-record loss |

---

## 5. Exit criteria — GREEN when all of the following hold

1. **MD-01 PASS** — Consultant Pipeline stage-move survives hard reload on SMOKETEST/golden lead
2. **MD-02 PASS** — Nurse safe clinical path mutation survives hard reload
3. **MD-03 PASS or SKIP (safe)** — Finance Money/invoice mutation holds, or documented why unsafe to mutate
4. **MD-05 PASS** — ≥1 raw-password login evidence
5. **MD-06** — No P0 identity / security / patient-record issue
6. Doctor **MD-04** PASS or explicit SKIP (not blocking if no safe fixture)

---

## 6. Method

1. Confirm Consultant (or other target) session on production
2. Exercise SMOKETEST-only mutation; record before/after state
3. Hard reload (full browser reload, not soft nav)
4. Confirm persisted state; log PASS/FAIL
5. Repeat for Nurse / Finance / raw-password as available
6. Score exit GREEN / AMBER / RED in findings

---

## 7. Related

- [fi-evolved-mutation-depth-1.md](./fi-evolved-mutation-depth-1.md) — findings
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md) — prior GREEN (scoped)
- [fi-evolved-operational-pilot-1-plan.md](./fi-evolved-operational-pilot-1-plan.md)
