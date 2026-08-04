# FI Trichoscopy — Staging Certification Evidence

Evidence for **FI-TRICHOSCOPY-1A.1 Live Staging Certification** lives here.

| Path | Purpose |
|------|---------|
| [FI-TRICHOSCOPY-1A.1-LIVE-STAGING-CERTIFICATION.md](./FI-TRICHOSCOPY-1A.1-LIVE-STAGING-CERTIFICATION.md) | Canonical runbook, acceptance criteria, current verdict |
| [templates/certification-run-manifest.template.json](./templates/certification-run-manifest.template.json) | Manifest schema for a completed GREEN run |
| `runs/<run-id>/` | One folder per executed certification (committed after GREEN) |
| `attachments/` | Redacted screenshots / reconciliation excerpts (no secrets, no PHI) |

## Verdict policy

- **AMBER** — foundations + stub tests pass; no live FiOS↔HLI round-trip recorded under `runs/`.
- **GREEN** — one complete live staging run committed under `runs/` with all required artifacts and acceptance checks marked PASS.
- **RED** — any hard failure in the phase brief (cross-tenant leak, unsigned events accepted, pack overwrite, unexplained recon differences).

Current verdict is tracked in the 1A.1 certification doc.
