# Validation

## Current verification scope

The repository currently verifies:

- TypeScript/Vite application build via `npm run build`
- Web utility and engine behavior via `npm run test`
- Rust workspace compilation and unit tests via `cargo test --workspace`

## Implemented automated checks

- DNA normalization and reverse-complement handling
- Two-fragment target construction
- Circular origin-crossing selection reconstruction
- Feature-location parsing and feature-driven fragment range application
- Mutation-planner transformations
- Primer/protocol export helpers
- Protocol mixing and recipe generation
- Local editor operations
- Protein-fusion approval flow for coding-sequence changes
- Rust-side sequence parsing, target construction, and unit conversions

## Not yet covered

- Browser interaction tests for full UI flows
- Wet-lab validation dataset
- Cross-implementation parity tests between TypeScript and Rust calculations
- GitHub Pages deployment smoke tests
- Genome-scale specificity result validation

## Recommended next validation steps

1. Add browser tests for import, mutation planning, compare mode, and export.
2. Add parity tests that compare selected TypeScript and Rust sequence/assembly outputs.
3. Add curated OE-PCR example fixtures under `test-data/`.
4. Record experimental outcomes in a versioned validation dataset.
