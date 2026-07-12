# Validation

## Current verification scope

The repository currently verifies:

- TypeScript/Vite application build via `npm run build`
- Web utility and engine behavior via `npm run test`
- GitHub Pages asset-path and no-external-font smoke checks via `npm run smoke:pages`
- Rust workspace compilation and unit tests via `cargo test --workspace`

## Implemented automated checks

- DNA normalization and reverse-complement handling
- Two-fragment target construction
- Circular origin-crossing selection reconstruction
- Feature-location parsing and feature-driven fragment range application
- Browser interaction flows for example loading, import application, mutation planning, export download wiring, and saved-project reload
- Mutation-planner transformations
- Primer/protocol export helpers
- Protocol mixing and recipe generation
- Reference Tm fixtures in [test-data/reference/tm-reference.json](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/test-data/reference/tm-reference.json)
- Reference product-reconstruction fixtures in [test-data/reference/product-reconstruction.json](/C:/Users/matte/Documents/GitHub/FusionPCR-Studio/test-data/reference/product-reconstruction.json)
- Local editor operations
- Protein-fusion approval flow for coding-sequence changes
- Rust-side sequence parsing, target construction, and unit conversions
- GitHub Pages relative-asset and external-font deployment smoke checks

## Not yet covered

- Full end-to-end browser interaction coverage for the entire workspace
- Wet-lab validation dataset
- Cross-implementation parity tests between TypeScript and Rust calculations
- Genome-scale specificity result validation

## Recommended next validation steps

1. Add browser tests for import, mutation planning, compare mode, and export.
2. Add parity tests that compare selected TypeScript and Rust sequence/assembly outputs.
3. Add curated OE-PCR example fixtures under `test-data/`.
4. Record experimental outcomes in a versioned validation dataset.
