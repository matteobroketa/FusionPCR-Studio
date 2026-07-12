# FusionPCR Studio

Local-first overlap-extension PCR design for two-fragment fusion workflows.

Live application: https://matteobroketa.github.io/FusionPCR-Studio/

![FusionPCR Studio screenshot](./docs/preview/app-screenshot.png)

This implementation focuses on the build plan's minimum viable release:

- import two DNA fragments
- parse plain DNA, FASTA, multi-FASTA, and GenBank sequence sources
- select the retained ranges to fuse
- insert an optional linker or mutation payload
- apply explicit fragment edits, including trim, extract, split, duplicate, replace, and targeted insert operations
- lock fragment, boundary, insert, and polymerase-setting fields during construct editing
- undo and redo project-level construct edits locally in the browser
- plan insertion, deletion, substitution, and domain-swap workflows by converting a recipient fragment into explicit left/right flanks plus payload
- filter the workspace by OE-PCR stage, with stage-specific product previews and primer overlays
- inspect a selectable junction node that separates upstream bases, inserted bases, downstream bases, annealing regions, and tailed contributions
- pin a design snapshot and compare current versus pinned oligo length, dimer severity, Tm spread, overlap Tm, and off-target counts
- rank whole-design alternatives with approximate quality scores and optimizer priorities such as balanced, lower-dimer, shorter-oligo, and higher-overlap choices
- choose an explicit junction mode, including protein fusion
- generate the four OE-PCR primers with explicit tail/body separation
- calculate Primer3-style nearest-neighbour primer Tm with monovalent, magnesium, dNTP, oligo, and DMSO settings
- analyze local secondary structure, including hairpins, homodimers, 3 prime dimers, and pairwise primer interactions
- run local specificity scans across imported templates, reverse complements, simulated stage products, and the final construct
- generate a Primer-BLAST handoff package with explicit organism/database context for optional external genomic specificity checks
- simulate both first-stage products and the final fusion product
- verify exact agreement with the requested target sequence
- audit coding-frame continuity, translated products, and retained start/stop codons in protein-fusion mode
- optionally apply beam-searched synonymous codon optimization near a protein-fusion junction while preserving the translated product
- require explicit approval before proposed start/stop removal or synonymous coding changes alter the effective fused construct
- produce a starting PCR plan for `Q5` or `Phusion Plus`
- calculate equimolar stage-product mixing, primer dilution, master-mix totals, and cycle planning
- generate profile-aware reagent-by-reagent reaction recipes for stage 1 and fusion PCR setups
- export project JSON, oligo-ordering CSV, primer FASTA, final-construct FASTA, first-stage amplicon FASTA, annotated GenBank, printable protocol, pipetting table, thermocycler program, junction report, validation report, expected gel sketch, calculation manifest, and Primer-BLAST handoff text

The repository now also includes an emerging Rust workspace with `fusion-core` and `fusion-wasm`, plus CI and GitHub Pages workflow scaffolding that move the project closer to the planned architecture.

Privacy note: sequence data stays in the browser during ordinary use. Exporting a Primer-BLAST handoff or submitting it to an external service moves sequence information outside the local-first runtime.

Imported fragment metadata currently includes source format, topology, checksum, ambiguous-base detection, and preserved GenBank feature labels/locations.
Imported GenBank features can now drive fragment range selection when their locations are simple intervals or supported circular origin-wrap joins.
Circular source selections can now cross the origin during design when imported fragments are marked as circular.
Construct editing currently exposes explicit reversible operations plus lock-aware history tracking.
Mutation-oriented modes currently include a dedicated recipient/payload planner instead of relying only on manual fragment slicing.
The construct canvas currently exposes toggleable fragment, construct, primer, feature, translation, GC/Tm, risk, and stage-product tracks plus a selectable junction inspector.
Thermodynamic outputs currently include annealing-body Tm, full-oligo nominal Tm, and overlap Tm for tailed inner primers.
Specificity outputs currently include local primer-binding sites and predicted unintended amplicons from risky site pairs.
Specificity outputs now also include an explicit Primer-BLAST handoff export, while keeping sequence submission outside the browser under user control.
Structure outputs currently include approximate diagrams, estimated delta G, predicted Tm, stem length, 3 prime pairing counts, and intended inner-primer complementarity reporting.
Optimizer outputs currently include an approximate design quality score, component breakdown, and ranked whole-design alternatives across the current primer search space.
Protein-fusion outputs currently include junction-local synonymous codon proposals with visible per-codon changes.
Protein-fusion sequence changes currently remain pending until approved in the project state and exports.
Protocol outputs currently include stage-product mixing targets, primer working-stock preparation, per-primer usage totals, and master-mix volume estimates.
Protocol outputs now also include reagent-by-reagent reaction recipes with primer, template, DMSO, water, and polymerase-profile-specific mix components.
Export outputs now also include construct-centric sequence files, reporting artifacts, and conservative GenBank annotation derived from selected source spans plus any safely mappable imported features.

## Development

```bash
npm install
npm run test
npm run build
npm run test:rust
npm run dev
```

## Repository notes

- [METHODS.md](./METHODS.md) documents the implemented primer-design and product-simulation approach.
- [THERMODYNAMIC_MODELS.md](./THERMODYNAMIC_MODELS.md) records the current Tm and salt-correction assumptions.
- [PROJECT_FORMAT.md](./PROJECT_FORMAT.md) describes the saved project JSON shape and normalization behavior.
- [POLYMERASE_PROFILES.md](./POLYMERASE_PROFILES.md) summarizes the currently implemented profile and recipe defaults.
- [LIMITATIONS.md](./LIMITATIONS.md) records the current scientific and product boundaries of this release.
- [VALIDATION.md](./VALIDATION.md) records current automated verification and validation gaps.
- [CHANGELOG.md](./CHANGELOG.md) tracks release-facing changes.
