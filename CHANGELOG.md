# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Added a Rust workspace with `fusion-core` and `fusion-wasm`.
- Added tested Rust-side sequence parsing, target construction, and protocol conversion helpers.
- Added stage-aware construct review, mutation planning, explicit coding-change approvals, protocol recipes, and Primer-BLAST handoff support in the web app.
- Expanded the export package with construct FASTA, stage-product FASTA, GenBank, pipetting, thermocycler, gel, junction, validation, and calculation-manifest outputs.
- Added repository documentation for thermodynamic models, project JSON format, and polymerase profiles.
- Added importable example projects plus starter `test-data/` and `validation/` directories.

## 0.1.0-alpha.2

- Added Playwright production-build browser tests, strict browser failure auditing, and post-deployment Pages smoke coverage.
- Expanded Primer3-backed Tm fixtures, curated OE-PCR reconstruction fixtures, and TypeScript-versus-Rust parity checks for the shared engine surface.
- Added authoritative-engine documentation and clearer approximate-labeling for heuristic structure and quality outputs.

## 0.1.0-alpha.1

- Initial alpha release for the deployable two-fragment OE-PCR MVP.
