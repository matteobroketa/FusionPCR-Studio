# FusionPCR Studio

Local-first overlap-extension PCR design for two-fragment fusion workflows.

Live application: https://matteobroketa.github.io/FusionPCR-Studio/

![FusionPCR Studio screenshot](./docs/preview/app-screenshot.png)

## Public alpha.3 MVP

The public interface for `0.1.0-alpha.3` is intentionally narrow:

- import two DNA fragments from plain DNA, FASTA, multi-FASTA, or GenBank sources
- select retained source ranges and optionally insert a short linker sequence
- generate a four-primer, two-stage OE-PCR design for exact fusion or protein fusion
- review the construct junction, stage products, primers, and local in-project specificity results
- verify exact final-product reconstruction plus protein-fusion frame/start/stop checks
- plan basic `Q5` or `Phusion Plus` reaction mixes and cycling inputs
- export only the five public MVP artifacts:
  `project JSON`, `oligo-ordering CSV`, `primer FASTA`, `final-construct FASTA`, and `printable protocol`

## Hidden experimental modules

The repository still contains internal or experimental code paths that are not part of the public alpha.3 MVP:

- mutation-oriented sequence rewriting helpers
- broader technical export builders
- external Primer-BLAST handoff helpers
- additional design/reporting utilities that are not exposed in the public navigation or export surface

The repository now also includes an emerging Rust workspace with `fusion-core` and `fusion-wasm`, plus CI and GitHub Pages workflow scaffolding that move the project closer to the planned architecture.

Privacy note: sequence data stays in the browser during ordinary use in the public MVP.

Imported fragment metadata currently includes source format, topology, checksum, ambiguous-base detection, and preserved GenBank feature labels/locations.
Imported GenBank features can now drive fragment range selection when their locations are simple intervals or supported circular origin-wrap joins.
Circular source selections can now cross the origin during design when imported fragments are marked as circular.
Construct editing currently exposes explicit reversible operations plus lock-aware history tracking.
Mutation-oriented modes currently include a dedicated recipient/payload planner instead of relying only on manual fragment slicing.
The construct canvas currently exposes toggleable fragment, construct, primer, feature, translation, GC/Tm, risk, and stage-product tracks plus a selectable junction inspector.
Thermodynamic outputs currently include annealing-body Tm, full-oligo nominal Tm, and overlap Tm for tailed inner primers.
Specificity outputs currently include local primer-binding sites and predicted unintended amplicons from risky site pairs.
Structure outputs currently include approximate diagrams, estimated delta G, predicted Tm, stem length, 3 prime pairing counts, and intended inner-primer complementarity reporting.
Optimizer outputs currently include an approximate design quality score, component breakdown, and ranked whole-design alternatives across the current primer search space.
Protein-fusion outputs currently include junction-local synonymous codon proposals with visible per-codon changes.
Protein-fusion sequence changes currently remain pending until approved in the project state and exports.
Protocol outputs currently include stage-product mixing targets, primer working-stock preparation, per-primer usage totals, and master-mix volume estimates.
Protocol outputs now also include reagent-by-reagent reaction recipes with primer, template, DMSO, water, and polymerase-profile-specific mix components.
Additional internal export builders still exist in source for technical review and future releases, but the public alpha.3 export surface is limited to the five MVP artifacts listed above.

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
