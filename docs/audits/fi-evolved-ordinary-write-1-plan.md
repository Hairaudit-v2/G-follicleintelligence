# FI-EVOLVED-ORDINARY-WRITE-1 — Audit plan

**Milestone:** `FI-EVOLVED-ORDINARY-WRITE-1`  
**Status:** **GREEN — complete** — Consultant ordinary-write (raw `manager@`, OW-01–05 PASS) + OW-06 impersonation Reception/Nurse write PASS  
**Date:** 2026-07-14  
**Mode:** Live production bake (Decision B host)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Prior (GREEN scoped):** `FI-EVOLVED-OPERATIONAL-PILOT-1` · `FI-EVOLVED-MUTATION-DEPTH-1` (MD-01–MD-05 PASS; MD-04 PASS observe)  
**Evidence commits:** `8432111a` · `5d619625` · `d7295b45`  
**Findings:** [fi-evolved-ordinary-write-1.md](./fi-evolved-ordinary-write-1.md)

---

## Preconditions confirmed (evidence lock)

**Do not regress:** Consultant ordinary-write is **GREEN — complete** under raw `manager@` Consultant (OW-01–05 PASS). It is **not** provisional, **not** incomplete, and **not** impersonation-only. See findings evidence lock.

---

## 1. Problem statement (historical — closed)

**Ordinary Consultant write parity was broken relative to impersonation** (closed by fix `8432111a` + raw re-bake).

Under **platform-admin impersonation**, `manager@evolvedhair.com.au` (Consultant workspace) completed Pipeline stage-move + hard reload (**MD-01 PASS**). Under the same identity via **raw password** (**MD-05 PASS** for identity/landing), Pipeline showed a **Read-only** banner: browse and open leads, but changes unavailable.

Impersonation proves the product *can* mutate for that persona; raw login does not grant the same write capability. Clinic day cannot depend on a developer impersonation wrapper.

---

## 2. Why this matters for clinic day

- Real staff log in with passwords — not Exit-impersonation sessions.
- If Consultant Pipeline is Read-only for ordinary sessions, enquiry progression stalls without developer help.
- Mutation-depth GREEN measured the happy path under impersonation for MD-01; MD-05 deliberately did not score the Read-only observe as a fail. That gap is now the milestone.
- Closing it restores trust that pilot + mutation evidence applies to ordinary staff sessions.

---

## 3. Core question

**Can an ordinary (raw-password) Consultant mutate Pipeline the same way an impersonated Consultant can — and does that mutation survive hard reload?**

Optional: one Reception or Nurse ordinary-write path if time allows after Consultant GREEN path is clear.

---

## 4. In scope

| Surface / action | Role | Notes |
| ---------------- | ---- | ----- |
| Pipeline write capability under raw password | Consultant (`manager@`) | Capture Read-only banner + claims; root-cause; fix if P0/P1; re-bake stage-move + reload |
| Stage-move + hard reload (raw session) | Consultant | Same golden SMOKETEST lead path as MD-01 when writes restored |
| Optional single write path | Reception or Nurse | One reversible SMOKETEST mutation under raw password if available; not blocking if Consultant GREEN is solid |
| Claims / shell parity check | Consultant (primary) | Impersonation vs raw session: CRM shell access, role claims, `canMutate` |

All mutations **SMOKETEST-only** (or known golden lead/patient). No production patient data writes beyond reversible stage moves on golden fixtures.

---

## 5. Out of scope

Mirror prior pilots — do **not** expand:

- Procedure Day automation
- Stripe / payment-provider expansion
- New AI features
- Nav redesign / new modules
- CI polish / hygiene follow-ups
- HR-DRIFT-01 unless it **blocks** ordinary write (mapping missing → write denied)
- Soft-nav P2 backlog
- Doctor ordinary **mutation** write (MD-04 closed as observe-only; no safe clinical mutation fixture)
- Re-litigating MD-01–MD-03 impersonation results
- Reception / Nurse **raw-password** ordinary-write — no passwords for those roles; OW-06 covered via platform impersonation. Ordinary raw Consultant write is closed under `manager@` (OW-01–05). Doctor raw observe closed under `tlbpmg@` (MD-04).

---

## 6. Investigation targets

| Target | Why |
| ------ | --- |
| Pipeline write gate (`permissions.canMutate` → `PipelineReadOnlyNotice`) | MD-05 observe: banner copy from `pipelineUi` when `canMutate` false |
| CRM shell access (`crmShellAccess` / `crmShellLoaders` / `crmGatePolicy`) | Loader may derive mutate from operator context differently for proxy vs ordinary |
| Role claims / staff_role / tenant-admin roles on raw session | Raw `manager@` may lack claim impersonation injects |
| Impersonation vs raw session capability gap | MD-01 write PASS under impersonation; MD-05 Read-only under raw — same email, different mutate |
| Server-side stage-move reject vs UI-only gate | Confirm whether API also denies ordinary Consultant writes |
| HR / staff mapping (only if write blocked) | Rule out missing mapping as sole cause before large code changes |

Likely code anchors (start points, not exhaustive):

- `src/components/fi/crm/pipeline/PipelineWorkspace.tsx` — Read-only notice when `!permissions.canMutate`
- `src/lib/crm/crmGatePolicy.ts` — `canMutateClinicFromOperatorContext`
- `src/lib/crm/crmShellAccess` / `pipelineLoader.server.ts` — permissions assembly
- Platform-admin tenant proxy write tests (`platformAdminTenantProxyWrite.test.ts`) — compare proxy path to ordinary

---

## 7. Roles

| Priority | Role | Identity | Expectation |
| -------- | ---- | -------- | ----------- |
| **Primary** | Consultant | `manager@evolvedhair.com.au` **raw password** (no impersonation) | **CLOSED PASS** — Pipeline writes + stage-move + reload (OW-01–05) |
| Optional | Reception | Impersonation (no raw password) | **OW-06 PASS** — Front desk Start treatment + reload (Jesika) |
| Optional | Nurse | Impersonation (no raw password) | **OW-06 PASS** — Front desk Start treatment + reload (Evie) |

Do **not** score Consultant ordinary write as PASS while Exit impersonation is visible. Do **not** re-label closed Consultant ordinary-write as impersonation-only or provisional.

---

## 8. Bake sequence

1. **Capture** — Stay logged in (or re-login) as raw `manager@evolvedhair.com.au`. Screenshot / note Pipeline **Read-only** banner. Record CDP/session claims (no Exit impersonation). Note `canMutate` / shell flags if exposed in RSC payload or network.
2. **Root-cause** — Diff impersonation session capabilities vs raw for same user; walk CRM shell + gate policy until mutate flips false.
3. **Fix P0/P1** — Restore ordinary Consultant write parity without weakening real read-only roles (auditor / true read-only staff must stay read-only).
4. **Re-bake** — Under raw password: Pipeline stage-move on golden SMOKETEST lead + hard reload (same discipline as MD-01); revert when non-destructive.
5. **Score** — GREEN / AMBER / RED against exit criteria; log defects P0–P3.
6. **Optional** — One Reception or Nurse ordinary-write path if primary path is GREEN and time remains.

---

## 9. Check matrix

| ID | Check | GREEN signal |
| -- | ----- | ------------ |
| OW-01 | Raw Consultant session purity | `manager@` ordinary login; no Exit impersonation; Consultant workspace |
| OW-02 | Pipeline write capability (raw) | No erroneous Read-only banner for Consultant who should mutate; Change stage (or equivalent) available |
| OW-03 | Stage-move + hard reload (raw) | Stage holds after full reload on SMOKETEST/golden lead (MD-01 parity) |
| OW-04 | Impersonation ≠ required for write | Ordinary session succeeds without platform-admin proxy |
| OW-05 | True read-only preserved | Sessions that should be read-only still gated (no over-broad write grant) |
| OW-06 | Optional Reception/Nurse ordinary write | **PASS** (impersonation Jesika then Evie — Front desk Start treatment + reload; soft-nav FD→Calendar) |
| OW-07 | No P0 | No identity, security, or patient-record loss |

---

## 10. Exit criteria — GREEN when all of the following hold

1. **OW-01 PASS** — Raw-password Consultant session confirmed (no impersonation wrapper)
2. **OW-02 PASS** — Pipeline is writable for that ordinary Consultant (no false Read-only)
3. **OW-03 PASS** — Stage-move survives hard reload under that raw session
4. **OW-04** — Write does not require impersonation
5. **OW-05** — Legitimate read-only roles remain read-only
6. **OW-07** — No P0 identity / security / patient-record issue
7. **OW-06** optional — **PASS** (impersonation Reception/Nurse); does not redefine Consultant ordinary-write (raw OW-01–05)

**AMBER** if root cause is known and a safe temporary SOP exists but ordinary write still blocked.  
**RED** if ordinary Consultant cannot mutate Pipeline and no safe workaround without developer intervention.

---

## 11. Defect classification

| Severity | Definition | Example for this milestone |
| -------- | ---------- | -------------------------- |
| **P0** | Identity breach, security hole, or patient-record loss / corruption | Wrong tenant writes; stage write applied to wrong patient; privilege escalation granting Platform admin |
| **P1** | Blocks ordinary clinic work for a primary role; no safe staff SOP | Consultant raw session permanently Read-only on Pipeline (this milestone’s primary hypothesis) |
| **P2** | Workaround exists; polish / secondary path | Soft-nav lag; board drag disabled while detail Change stage works; optional role SKIP |
| **P3** | Cosmetic / observe-only | Banner copy wording; non-blocking UI chrome |

**MD-05 observe** (Read-only under raw `manager@`) enters this milestone as suspected **P1** until disproved or fixed.

---

## 12. Method notes

- Prefer continuing the existing raw `manager@` browser session if still open; otherwise re-login with password (not impersonation).
- Reuse golden lead from MD-01 when mutating: `c9a58f3d-e1e4-4187-9986-59faed41565d` (SMOKETEST-OPDAY-20260702) unless superseded.
- Hard reload = full browser navigate/reload, not soft SPA click.
- Document before/after stage IDs; revert when non-destructive.

---

## 13. Related

- [fi-evolved-ordinary-write-1.md](./fi-evolved-ordinary-write-1.md) — findings (**GREEN — complete**)
- [fi-evolved-mutation-depth-1.md](./fi-evolved-mutation-depth-1.md) — MD-01–05 PASS; MD-04 PASS observe
- [fi-evolved-mutation-depth-1-plan.md](./fi-evolved-mutation-depth-1-plan.md)
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md) — prior GREEN (scoped)
