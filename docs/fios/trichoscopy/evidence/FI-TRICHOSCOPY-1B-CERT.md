# FI-TRICHOSCOPY-1B-CERT — Consultation Integration Certification

**Status:** AMBER — architecture and automated suite ready; live staging round-trip and browser evidence pending  
**Date opened:** 2026-08-04  
**Evidence root:** `docs/fios/trichoscopy/evidence/`  
**Automated suite:** `npm run test:trichoscopy-1b`  
**Cert harness:** `npm run certify:trichoscopy-1b`

## Executive instruction

Accept the 1B implementation as **feature-complete at the architecture and code level**. Keep the phase **AMBER** until the live consultation round-trip, clinical-authority controls, evidence-version immutability, replay behaviour, and browser journey are demonstrated in staging.

## Objective

Prove a complete FiOS consultation ↔ HLI trichoscopy consultation integration using a synthetic staging patient, including indication/consent, authenticated findings, clinician review, decision links, follow-up, pack pinning under supersession, and mandatory negative tests.

## Preflight (blocking for GREEN)

| # | Check | How |
|---|--------|-----|
| P1 | Staging FiOS base URL reachable | `FI_TRICHOSCOPY_CERT_BASE_URL` |
| P2 | Platform flag on | `FI_ENABLE_HLI_TRICHOSCOPY=1` |
| P3 | Live HLI credentials | `HLI_TRICHOSCOPY_API_BASE_URL`, `SERVICE_KEY`, `SIGNING_SECRET`, `WEBHOOK_SECRET` |
| P4 | Adapter not in stub mode | Harness prints `useStub=false` |
| P5 | Migrations applied | `20261108120001`, `20261108120002`, **`20261109120001`** |
| P6 | Entitled + negative-control tenants | IDs in run folder |
| P7 | Synthetic patient + clinician user | No real PHI |
| P8 | Automated suite green | `npm run test:trichoscopy-1b` |

```bash
npm run certify:trichoscopy-1b:preflight
npm run certify:trichoscopy-1b:init-run
npm run certify:trichoscopy-1b:security-probes
```

## Primary journey (operator-supervised)

1. Open an active FiOS consultation.
2. Record a trichoscopy indication.
3. Capture consent (capture + transfer).
4. Submit the request to live staging HLI.
5. Confirm consultation link and correlation identifiers.
6. Complete or simulate a genuine HLI assessment.
7. Publish an evidence pack.
8. Receive the signed event in FiOS.
9. Import and normalise findings.
10. Review findings in the consultation workspace.
11. Accept one finding with qualification.
12. Reject / disagree with another finding.
13. Link an accepted finding to a treatment decision.
14. Link another finding to a pathology / medical-review action.
15. Schedule a follow-up trichoscopy assessment.
16. Finalise the consultation (`consultation_finalised_at` set).
17. Publish a superseding HLI pack.
18. Confirm completed consultation remains pinned to the reviewed version.
19. Confirm the new pack creates audit / review workflow **without rewriting history**.
20. Run reconciliation and capture the result.

## Mandatory negative tests

| ID | Negative | Automated | Live |
|----|----------|-----------|------|
| N1 | Surgical-only user cannot accept findings | Cap layers | Staging roles |
| N2 | Reception user cannot access clinical findings | Cap layers | Staging roles |
| N3 | Patient cannot access clinician-only findings | Patient-safe summary | Portal check |
| N4 | Cross-tenant consultation access denied | Cap + resource | API probe |
| N5 | Findings cannot create diagnosis without acceptance | Guard unit | UI denial |
| N6 | Invalid HLI signature rejected before clinical writes | Unit + harness | Probe |
| N7 | Expired signature rejected | Unit + harness | Probe |
| N8 | Duplicate event → no duplicate findings/actions | Pure uniqueness + 1A idemp | Replay |
| N9 | Duplicate request → no duplicate usage event | Idempotency key | Replay |
| N10 | HLI outage does not block consultation completion | Readiness | Demo |
| N11 | Completed consultation cannot be silently mutated | Finalise + gates | After step 16 |
| N12 | Superseded / withdrawn packs remain historically visible | Visibility helper | Pack list |

## Recommended evidence packet

Populate from templates under `templates/1b/` into `runs/<run-id>/`:

| File | Purpose |
|------|---------|
| `FI-TRICHOSCOPY-1B-CERT.md` | This runbook (canonical) |
| `consultation-request.json` | Redacted outbound request |
| `hli-event-sequence.json` | Signed inbound events |
| `imported-findings.json` | Normalised findings |
| `finding-reviews.json` | Ack states |
| `decision-links.json` | Treatment / pathology links |
| `evidence-pack-lineage.json` | Original + superseding packs + pin |
| `reconciliation.json` | Balanced result |
| `authorisation-results.json` | Role / tenant negatives |
| `replay-results.json` | Duplicate / OOO safety |
| `screenshots/` | Clinician consultation workspace |

## GREEN criteria

FI-TRICHOSCOPY-1B moves to **GREEN** when all are true:

| ID | Criterion | Result |
|----|-----------|--------|
| G1 | Migration `20261109120001` applied in staging | ☐ |
| G2 | Real consultation request reaches HLI | ☐ |
| G3 | Authenticated findings return to FiOS | ☐ |
| G4 | Findings reviewed through consultation UI | ☐ |
| G5 | Clinical decisions require explicit authorised acceptance | ☐ |
| G6 | Decision links and follow-ups persist | ☐ |
| G7 | Completed consultations remain immutable | ☐ |
| G8 | Supersession creates review/audit workflow without rewrite | ☐ |
| G9 | Duplicate and out-of-order events are safe | ☐ |
| G10 | Role and tenant boundaries pass | ☐ |
| G11 | HLI outage behaviour demonstrated | ☐ |
| G12 | Reconciliation balanced | ☐ |
| G13 | Automated + browser tests pass | ☐ |
| G14 | Evidence packet committed under `runs/` | ☐ |

## Run record

| Field | Value |
|-------|-------|
| Verdict | **AMBER** |
| Blocking reason | Live staging consultation round-trip + browser screenshots not yet executed |
| Unit foundation | `npm run test:trichoscopy-1b` (pass required) |
| Playwright | `e2e/journeys/trichoscopy-consultation-1b.spec.ts` |
| Live run folder | _none yet_ |
| Commits / deployments | Record in `runs/<run-id>/manifest.json` |
| Sign-off | Pending G1–G14 |

When credentials are available, run the journey, fill the JSON artifacts, commit `runs/<run-id>/`, and flip verdict to GREEN only if G1–G14 all PASS.
