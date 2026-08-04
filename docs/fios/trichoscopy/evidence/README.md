# FI Trichoscopy — Staging Certification Evidence

Evidence for trichoscopy staging certification lives here.

| Path | Purpose |
|------|---------|
| [FI-TRICHOSCOPY-1A.1-LIVE-STAGING-CERTIFICATION.md](./FI-TRICHOSCOPY-1A.1-LIVE-STAGING-CERTIFICATION.md) | 1A.1 runbook, acceptance criteria, current verdict |
| [FI-TRICHOSCOPY-1B-CERT.md](./FI-TRICHOSCOPY-1B-CERT.md) | 1B consultation integration cert runbook |
| [templates/certification-run-manifest.template.json](./templates/certification-run-manifest.template.json) | 1A.1 manifest schema |
| [templates/1b/](./templates/1b/) | 1B artifact templates (request, findings, reviews, lineage, …) |
| `runs/<run-id>/` | One folder per executed certification (committed after GREEN) |
| `attachments/` | Redacted screenshots / reconciliation excerpts (no secrets, no PHI) |

## Verdict policy

- **AMBER** — foundations + automated suite pass; no live FiOS↔HLI round-trip recorded under `runs/`.
- **GREEN** — one complete live staging run committed under `runs/` with all required artifacts and acceptance checks marked PASS.
- **RED** — any hard failure in the phase brief (cross-tenant leak, unsigned events accepted, pack overwrite, unexplained recon differences).

Current verdicts: see the 1A.1 and 1B-CERT documents (both AMBER until live evidence is committed).
