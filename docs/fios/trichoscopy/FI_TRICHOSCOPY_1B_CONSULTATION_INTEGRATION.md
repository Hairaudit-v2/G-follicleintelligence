# FI-TRICHOSCOPY-1B — Consultation Integration

## Ownership boundaries

- **FiOS** owns the consultation record, clinician decisions, readiness, patient-safe summary, actions, and audit.
- **HLI** owns capture, specialist measurement, interpretation, and versioned evidence packs.
- **HairAudit** remains independent for surgical/outcome review.

No HLI finding silently becomes a FiOS diagnosis, treatment, investigation, or patient-facing claim.

## Verdict

**AMBER** — consultation foundation, findings review, clinical action linkage, patient-safe summary, and follow-up scheduling are implemented in-repo with unit coverage. Live staging FiOS↔HLI consultation round-trip and browser certification remain pending (1B.6).

## Migration

`supabase/migrations/20261109120001_fi_hli_trichoscopy_consultation_1b.sql`

| Table | Purpose |
|-------|---------|
| `fi_hli_trichoscopy_consultation_links` | Consultation↔request/assessment + pinned pack version |
| `fi_hli_trichoscopy_indications` | Structured indication / consent / urgency |
| `fi_hli_trichoscopy_findings` | Normalised versioned findings |
| `fi_hli_trichoscopy_finding_reviews` | Clinician acknowledgement |
| `fi_hli_trichoscopy_decision_links` | Evidence → decision provenance |
| `fi_hli_trichoscopy_consultation_rules` | Tenant recommendation / blocking rules |
| `fi_hli_trichoscopy_followups` | Baseline-linked reassessment plans |
| `fi_hli_trichoscopy_consultation_audit` | Consultation-scoped audit |

## Capabilities (1B)

| Capability | Role |
|------------|------|
| `trichoscopy.view_status` | Status card / workflow status |
| `trichoscopy.view_evidence` | Evidence pack view |
| `trichoscopy.review_findings` | Acknowledge / disagree / need more evidence |
| `trichoscopy.accept_findings` | Accept into assessment / link clinical decisions |
| `trichoscopy.request_additional_evidence` | Additional evidence request mode |
| `trichoscopy.escalate` | Escalation |
| `trichoscopy.withdraw` | Withdraw |
| `trichoscopy.configure_consultation_rules` | Tenant rules |
| `trichoscopy.view_audit_history` | Audit trail |

Aliases map `view_status`→`view`, `view_evidence`→`confirmed_evidence`, `review_findings`→`review` when only 1A entitlements are present.

Surgical tier does **not** include `trichoscopy.accept_findings`.

## APIs

| Route | Method |
|-------|--------|
| `/api/fi-admin/[tenantId]/consultations/[consultationId]/trichoscopy` | GET |
| `.../trichoscopy/indication` | POST |
| `.../trichoscopy/request` | POST |
| `.../trichoscopy/link` | POST |
| `.../trichoscopy/request-evidence` | POST |
| `.../trichoscopy/findings/[findingId]/review` | POST |
| `.../trichoscopy/actions` | POST |
| `.../trichoscopy/follow-up` | POST |
| `.../trichoscopy/defer` | POST |
| `.../trichoscopy/not-required` | POST |
| `.../trichoscopy/audit` | GET |

Inbound HLI lifecycle continues via `/api/integrations/hli/trichoscopy/events` (1A).

## UI

- Consultation hub section `trichoscopy` (status card + expand review workspace)
- Routing tile “Open Trichoscopy”
- Patient workspace accepts `?consultationId=` for linked requests

## Adapter package

`src/lib/integrations/hliTrichoscopy/consultation/`

Pure logic is unit-tested; server orchestration in `service.server.ts`.

## Tests

```bash
npm run test:trichoscopy-1b
```

## Rollback

1. Set `FI_ENABLE_HLI_TRICHOSCOPY=0` or disable tenant module configuration.
2. Hide request/review actions (section still renders historical/read-only when entitled).
3. Do **not** drop tables; preserve findings, reviews, decisions, packs, and audit.
4. Stop new outbound requests; continue safely receiving or quarantining authenticated events.

## Phase checklist

| Sub-phase | Status |
|-----------|--------|
| 1B.1 Consultation Foundation | Implemented (AMBER) |
| 1B.2 Findings Review | Implemented (AMBER) |
| 1B.3 Clinical Actions | Implemented (AMBER) |
| 1B.4 Patient Communication | Implemented (AMBER) |
| 1B.5 Longitudinal Follow-Up | Implemented (AMBER) |
| 1B.6 Live Certification | Pending |

## GREEN criteria (pending)

- Live staging consultation round-trip with signed events
- Clinician review + evidence-version pin
- Clinical action linkage
- Replay / duplicate safety
- Browser evidence of principal clinician workflow
- HLI outage does not block base consultation documentation
