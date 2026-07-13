# Validation

## Current verification scope

The repository currently verifies:

- TypeScript/Vite application build via `npm run build`
- Vitest unit and integration coverage via `npm run test`
- Playwright browser coverage against the production Vite build via `npm run test:e2e`
  Chromium functional flow plus Chromium/Firefox/WebKit smoke projects
- GitHub Pages built-asset smoke checks via `npm run smoke:pages:dist`
- Rust workspace compilation and tests via `cargo test --workspace`
- Post-deployment Playwright smoke checks against the public Pages URL in Chromium, Firefox, and WebKit via [.github/workflows/deploy-pages.yml](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/.github/workflows/deploy-pages.yml)

## Fixture inventory

- Tm reference fixtures: `32`
  Source: [test-data/reference/tm-reference.json](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/test-data/reference/tm-reference.json)
  Coverage: sequence composition, oligo length, monovalent salt, Mg, dNTP chelation, DMSO, concentration, symmetry, and rejection cases.
- OE-PCR reconstruction fixtures: `12`
  Source: [test-data/reference/product-reconstruction.json](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/test-data/reference/product-reconstruction.json)
  Coverage: exact fusion, linker insertion, insertion, deletion, substitution, circular selections, coding-frame preservation, approved coding-sequence edits, and blocking failures.

## Browser-test coverage

The Playwright suite currently covers:

- worker startup from the production Vite build in Chromium, Firefox, and WebKit smoke runs
- loading the two supported built-in examples
- primer generation visibility and final-product verification on a runnable design
- blocking-issue rendering for invalid input
- all 5 public MVP exports:
  `project JSON`, `oligo-ordering CSV`, `primer FASTA`, `final-construct FASTA`, and `printable protocol`
- deployed-pages smoke passes against the public GitHub Pages URL in Chromium, Firefox, and WebKit

The Playwright fixture fails the job on:

- browser console errors
- uncaught browser exceptions
- failed document/script/worker requests
- displayed `NaN`, `Infinity`, or `-Infinity` values

## TypeScript versus Rust parity coverage

The repository now checks parity for every calculation currently implemented in both engines:

- `parse_sequence`
- `reverse_complement`
- `gc_fraction` versus TypeScript GC reporting at its current displayed precision
- exact and approved-protein-fusion target construction
- `pmol_to_mass_ng`
- `mass_ng_to_pmol`
- `volume_for_mass`

See [src/utils/parity.test.ts](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/src/utils/parity.test.ts) and [crates/fusion-core/src/bin/parity-cli.rs](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/crates/fusion-core/src/bin/parity-cli.rs).

## Authoritative engine map

Rust is authoritative for the shared cross-language core:

- sequence parsing and validation
- reverse-complement generation
- GC-fraction calculation
- selected-range target construction for the Rust-supported exact/protein subset
- scalar protocol unit conversions

TypeScript is authoritative for the active browser design engine:

- primer candidate generation
- full design assembly and ranking
- overlap assessment
- thermodynamics as currently surfaced in the UI
- heuristic structure analysis
- local specificity analysis
- full protocol-plan assembly
- browser exports and review summaries

## Remaining scientific gaps

- Tm fixtures are now Primer3-backed, but the TypeScript thermodynamics engine is still validated within documented tolerances rather than exact Primer3 numerical identity across all conditions.
- Secondary-structure outputs remain heuristic approximations and are not calibrated against wet-lab outcomes.
- Design quality scores remain heuristic and are not experimentally calibrated probabilities of success.
- Local specificity remains a project-local screen; genome-scale specificity is not part of the public MVP and survives only as a hidden experimental handoff module.
- No wet-lab validation dataset is yet included.
- Rust is not yet authoritative for the full primer-design, thermodynamics, specificity, or protocol-planning runtime.
