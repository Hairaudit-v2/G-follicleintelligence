# FI Trichoscopy — Reconciliation

## Functions

- `reconcileTrichoscopyLink(linkId)`
- `reconcileTrichoscopyEpisode(episodeId)`
- `reconcileRecentTrichoscopyEvents()`

## Rules

- Compare FiOS link status vs HLI episode status, latest session/assessment/pack, open actions.
- Record run + changes + discrepancies on `fi_hli_trichoscopy_reconciliation_runs`.
- Never silently downgrade a confirmed FiOS state based on an older HLI event.
