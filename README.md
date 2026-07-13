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

Internal and experimental modules are documented separately in [EXPERIMENTAL_MODULES.md](./EXPERIMENTAL_MODULES.md).

Privacy note: sequence data stays in the browser during ordinary use in the public MVP.

The repository also includes an emerging Rust workspace with `fusion-core` and `fusion-wasm`, plus CI and GitHub Pages workflow scaffolding that move the project toward the broader architecture described in the build plan without expanding the supported public alpha.3 surface.

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
- [EXPERIMENTAL_MODULES.md](./EXPERIMENTAL_MODULES.md) lists intentionally hidden modules that remain outside the public MVP.
- [LIMITATIONS.md](./LIMITATIONS.md) records the current scientific and product boundaries of this release.
- [VALIDATION.md](./VALIDATION.md) records current automated verification and validation gaps.
- [CHANGELOG.md](./CHANGELOG.md) tracks release-facing changes.
