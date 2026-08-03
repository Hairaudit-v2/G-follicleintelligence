# FI Trichoscopy — Evidence Packs

## Supported pack types (1A)

- `hli-trichoscopy-consultation-v1`
- `hli-trichoscopy-treatment-baseline-v1`
- `hli-trichoscopy-longitudinal-v1`
- `hli-trichoscopy-treatment-response-v1`
- `hli-trichoscopy-surgical-planning-v1`

## Immutability

- Confirmed packs are never overwritten in place.
- Newer packs create a new local row and mark prior packs `superseded`.
- `withdrawn` is used for HLI withdrawals.
- Checksums are validated on re-import when present.

## Safety display

FiOS must distinguish capture / draft / confirmed states and preserve HLI safety assertions (`assertsDiagnosis: false`, etc.). Patients must not see unpublished clinical evidence or billing controls.
